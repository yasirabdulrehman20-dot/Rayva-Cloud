import { EventEmitter } from 'events';
import { jobManager } from './jobs/JobManager.js';
import { workerManager } from './workers/WorkerManager.js';
import { scheduler } from './scheduler/Scheduler.js';
import { ExecutionEngine } from './jobs/ExecutionEngine.js';
import { executionLedger } from './ledger/ExecutionLedger.js';
import { logger } from './monitoring/SystemLogger.js';
import { dbService } from './database/db.js';
import {
  Job,
  JobType,
  JobPriority,
  JobPayload,
  SystemStatus,
  SimulationConfig,
  SchedulerStrategyType,
} from '../shared/types.js';

export class MainNode extends EventEmitter {
  private isProcessingLoopActive = false;
  private loopInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private simulationTimer: NodeJS.Timeout | null = null;

  private startTime = Date.now();
  private simulationActive = false;
  private maintenanceMode = false;
  private simConfig: SimulationConfig = {
    workerCount: 4,
    cpuCapacity: 8,
    ramCapacity: 16384,
    failureProbability: 5,
    jobArrivalRateMs: 4000,
    jobComplexity: 5,
  };

  public setMaintenanceMode(enabled: boolean): void {
    this.maintenanceMode = enabled;
    if (enabled) {
      logger.warn('MainNode', '[SYSTEM MAINTENANCE ENABLED] New job submissions are suspended.');
    } else {
      logger.info('MainNode', '[SYSTEM MAINTENANCE DISABLED] Resuming normal cluster job scheduling operations.');
    }
    this.emit('update');
  }

  public isMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  async start(): Promise<void> {
    logger.info('MainNode', 'Starting Rayva Cloud Main Node Controller...');

    // Start background scheduler loop (checks queue every 500ms)
    this.loopInterval = setInterval(() => this.processQueueLoop(), 500);

    // Heartbeat monitoring loop (checks worker heartbeats every 2000ms)
    this.heartbeatInterval = setInterval(() => this.monitorWorkerHealth(), 2000);

    logger.info('MainNode', 'Main Node active and listening for job workloads.');
  }

  public submitJob(
    name: string,
    type: JobType,
    priority: JobPriority = 'NORMAL',
    payload: JobPayload = {},
    userId?: string,
    submittedBy?: string
  ): Job {
    if (this.maintenanceMode) {
      throw new Error('System is currently under maintenance. New job submissions are suspended.');
    }
    const job = jobManager.createJob(name, type, priority, payload, 3, userId, submittedBy);
    this.emit('update');
    return job;
  }

  private async processQueueLoop(): Promise<void> {
    if (this.isProcessingLoopActive) return;
    this.isProcessingLoopActive = true;

    try {
      const nextJob = jobManager.getNextJob();
      if (nextJob) {
        await this.dispatchJob(nextJob);
      }
    } catch (err) {
      logger.error('MainNode', 'Error in scheduling dispatch loop', { error: String(err) });
    } finally {
      this.isProcessingLoopActive = false;
    }
  }

  public async processQueuedJobs(): Promise<void> {
    await this.processQueueLoop();
  }

  private async dispatchJob(job: Job): Promise<void> {
    job.status = 'SCHEDULING';
    jobManager.updateJob(job);
    this.emit('update');

    const allWorkers = workerManager.getAllWorkers();
    const { selectedWorker, decision } = scheduler.scheduleJob(job, allWorkers);

    if (!selectedWorker) {
      // Re-queue since no worker was available
      jobManager.requeueJob(job.id);
      this.emit('update');
      return;
    }

    const workerNode = workerManager.getWorkerNode(selectedWorker.id);
    if (!workerNode) {
      jobManager.requeueJob(job.id);
      return;
    }

    // Assign job to worker
    job.assignedWorkerId = selectedWorker.id;
    job.assignedWorkerName = selectedWorker.name;
    job.status = 'ASSIGNED';
    job.startTime = Date.now();
    jobManager.updateJob(job);

    workerNode.data.activeJobs++;
    workerNode.updateHeartbeat();

    this.emit('update');

    // Asynchronously execute task on worker
    this.executeOnWorker(job, workerNode.data.id);
  }

  private async executeOnWorker(job: Job, workerId: string): Promise<void> {
    const workerNode = workerManager.getWorkerNode(workerId);
    if (!workerNode) return;

    job.status = 'RUNNING';
    jobManager.updateJob(job);
    this.emit('update');

    logger.info('MainNode', `Worker ${workerNode.data.name} started execution of Job #${job.id}`);

    try {
      // Execute computational workload
      const result = await ExecutionEngine.execute(job);

      // Verify worker didn't fail during execution
      if (workerNode.data.status === 'FAILED' || workerNode.data.status === 'OFFLINE') {
        throw new Error(`Worker ${workerNode.data.name} suffered node crash during job execution.`);
      }

      job.status = 'COMPLETED';
      job.completionTime = Date.now();
      job.executionTimeMs = result.executionTimeMs;
      job.result = {
        summary: result.summary,
        details: result.output,
        inputHash: result.inputHash,
        resultHash: result.resultHash,
      };
      jobManager.updateJob(job);

      workerNode.recordJobCompletion(result.executionTimeMs);

      // Record to immutable Ledger
      await executionLedger.recordJobExecution(
        job,
        workerId,
        workerNode.data.name,
        result.inputHash,
        result.resultHash,
        result.executionTimeMs
      );

      logger.info('MainNode', `Job #${job.id} completed successfully by ${workerNode.data.name} in ${result.executionTimeMs}ms`);
      const owner = job.userId ? dbService.getUserById(job.userId) : null;
      logger.info('UserActivity', `Job completed - ${job.id} - ${owner?.email || job.userId || 'unknown user'}`, {
        action: 'JOB_COMPLETED',
        userId: job.userId,
        userEmail: owner?.email,
        role: owner?.role,
        resourceId: job.id,
      });
    } catch (err: any) {
      logger.error('MainNode', `Execution failure on Job #${job.id} at worker ${workerId}: ${err.message}`);
      const owner = job.userId ? dbService.getUserById(job.userId) : null;
      logger.error('UserActivity', `Job failed - ${job.id} - ${owner?.email || job.userId || 'unknown user'}`, {
        action: 'JOB_FAILED',
        userId: job.userId,
        userEmail: owner?.email,
        role: owner?.role,
        resourceId: job.id,
      });

      workerNode?.recordJobFailure();

      // Trigger Fault Tolerance Re-queue & Retry
      const currentJobStatus: string = job.status;
      const stillOwnedByFailedWorker =
        job.assignedWorkerId === workerId && (currentJobStatus === 'RUNNING' || currentJobStatus === 'ASSIGNED');
      const requeued = stillOwnedByFailedWorker
        ? jobManager.requeueJobForRetry(job.id, err.message || 'Worker execution error')
        : false;
      if (!requeued && stillOwnedByFailedWorker) {
        job.status = 'FAILED';
        job.error = err.message || 'Job execution failed';
        jobManager.updateJob(job);
      }
    } finally {
      this.emit('update');
    }
  }

  private monitorWorkerHealth(): void {
    const { failedWorkers } = workerManager.checkHeartbeats(10000);

    // If any workers failed, check for active jobs assigned to them and requeue
    failedWorkers.forEach((wId) => {
      const allJobs = jobManager.getAllJobs();
      const inFlightJobs = allJobs.filter(
        (j) => j.assignedWorkerId === wId && (j.status === 'RUNNING' || j.status === 'ASSIGNED')
      );

      inFlightJobs.forEach((job) => {
        logger.warn('MainNode', `Detecting orphaned Job #${job.id} on failed worker ${wId}. Requeuing for fault-tolerant retry.`);
        jobManager.requeueJobForRetry(job.id, `Worker node ${wId} failed heartbeat/health check`);
      });
    });

    this.emit('update');
  }

  // --- Simulation Controls ---
  public startSimulation(config?: Partial<SimulationConfig>): void {
    if (config) {
      this.simConfig = { ...this.simConfig, ...config };
    }
    this.simulationActive = true;
    if (this.simulationTimer) clearInterval(this.simulationTimer);

    logger.info('MainNode', 'Started workload simulation generator', this.simConfig);

    const jobTypes: JobType[] = [
      'PRIME_CALC',
      'FIBONACCI',
      'SORTING',
      'MATRIX_OPS',
      'HASH_CALC',
      'DATA_PROCESSING',
      'AI_INFERENCE',
    ];
    const priorities: JobPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

    this.simulationTimer = setInterval(() => {
      if (!this.simulationActive || this.maintenanceMode) return;

      const randomType = jobTypes[Math.floor(Math.random() * jobTypes.length)];
      const randomPrio = priorities[Math.floor(Math.random() * priorities.length)];
      const complexity = this.simConfig.jobComplexity || 5;

      const payload: JobPayload = {
        targetNumber: 20000 * complexity,
        arraySize: 30000 * complexity,
        matrixSize: 50 * complexity,
        iterations: 10000 * complexity,
      };

      this.submitJob(`Simulated Workload (${randomType})`, randomType, randomPrio, payload);

      // Random fault injection based on failureProbability
      if (Math.random() * 100 < this.simConfig.failureProbability) {
        const onlineWorkers = workerManager.getAllWorkers().filter((w) => w.status !== 'FAILED');
        if (onlineWorkers.length > 1) {
          const victim = onlineWorkers[Math.floor(Math.random() * onlineWorkers.length)];
          logger.warn('MainNode', `[Simulated Fault Injection] Injected node failure on ${victim.name}`);
          workerManager.simulateWorkerFailure(victim.id);
        }
      }
    }, this.simConfig.jobArrivalRateMs);

    this.emit('update');
  }

  public pauseSimulation(): void {
    this.simulationActive = false;
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
    logger.info('MainNode', 'Paused workload simulation');
    this.emit('update');
  }

  public getSystemStatus(): SystemStatus {
    const workers = workerManager.getAllWorkers();
    const jobs = jobManager.getAllJobs();

    const onlineWorkers = workers.filter((w) => w.status === 'ONLINE' || w.status === 'IDLE' || w.status === 'BUSY').length;
    const idleWorkers = workers.filter((w) => w.status === 'IDLE').length;
    const busyWorkers = workers.filter((w) => w.status === 'BUSY').length;
    const offlineWorkers = workers.filter((w) => w.status === 'OFFLINE').length;
    const failedWorkers = workers.filter((w) => w.status === 'FAILED').length;

    const completedJobsList = jobs.filter((j) => j.status === 'COMPLETED');
    const totalRuntimeMs = completedJobsList.reduce((acc, j) => acc + (j.executionTimeMs || 0), 0);
    const avgExecutionTimeMs = completedJobsList.length > 0 ? Math.round(totalRuntimeMs / completedJobsList.length) : 0;

    const totalCpu = workers.reduce((acc, w) => acc + w.currentCpuUsage, 0);
    const totalRam = workers.reduce((acc, w) => acc + w.currentRamUsage, 0);

    return {
      totalWorkers: workers.length,
      onlineWorkers,
      idleWorkers,
      busyWorkers,
      offlineWorkers,
      failedWorkers,
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => j.status === 'RUNNING' || j.status === 'ASSIGNED').length,
      queuedJobs: jobs.filter((j) => j.status === 'QUEUED' || j.status === 'SCHEDULING').length,
      completedJobs: completedJobsList.length,
      failedJobs: jobs.filter((j) => j.status === 'FAILED').length,
      cancelledJobs: jobs.filter((j) => j.status === 'CANCELLED').length,
      systemCpuUsage: workers.length > 0 ? Math.round(totalCpu / workers.length) : 0,
      systemRamUsage: workers.length > 0 ? Math.round(totalRam / workers.length) : 0,
      avgExecutionTimeMs,
      activeStrategy: scheduler.getActiveStrategyType(),
      simulationActive: this.simulationActive,
      maintenanceMode: this.maintenanceMode,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

export const mainNode = new MainNode();
