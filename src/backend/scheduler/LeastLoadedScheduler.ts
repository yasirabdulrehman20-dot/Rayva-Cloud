import { ISchedulingStrategy } from './SchedulingStrategy.js';
import { Job, WorkerNodeData, SchedulerDecision, SchedulerStrategyType } from '../../shared/types.js';

export class LeastLoadedScheduler implements ISchedulingStrategy {
  readonly type: SchedulerStrategyType = 'LEAST_LOADED';
  readonly name = 'Least-Loaded Scheduler';
  readonly description = 'Assigns job to the worker node currently carrying the lowest active workload and active job count.';

  selectWorker(
    job: Job,
    workers: WorkerNodeData[]
  ): { selectedWorker: WorkerNodeData | null; decision: SchedulerDecision } {
    const available = workers.filter(
      (w) => w.status === 'IDLE' || w.status === 'BUSY' || w.status === 'ONLINE'
    );

    const scores: Record<string, number> = {};
    const breakdowns: Record<string, any> = {};

    let selectedWorker: WorkerNodeData | null = null;
    let minWorkload = Infinity;

    available.forEach((w) => {
      // Workload score = 100 - (currentWorkload * 0.6 + activeJobs * 20)
      const loadFactor = w.currentWorkload * 0.6 + w.activeJobs * 20;
      const score = Math.max(0, 100 - loadFactor);
      scores[w.id] = Math.round(score * 10) / 10;

      breakdowns[w.id] = {
        activeJobs: w.activeJobs,
        currentWorkload: `${w.currentWorkload}%`,
        cpuUsage: `${w.currentCpuUsage}%`,
        score: scores[w.id],
      };

      if (loadFactor < minWorkload) {
        minWorkload = loadFactor;
        selectedWorker = w;
      }
    });

    const timestamp = Date.now();
    const reason = selectedWorker
      ? `Selected ${selectedWorker.name} with lowest active load (Workload: ${selectedWorker.currentWorkload}%, Active Jobs: ${selectedWorker.activeJobs}).`
      : 'No available worker nodes found.';

    const decision: SchedulerDecision = {
      jobId: job.id,
      jobName: job.name,
      selectedWorkerId: selectedWorker ? selectedWorker.id : '',
      selectedWorkerName: selectedWorker ? selectedWorker.name : 'NONE',
      timestamp,
      strategyUsed: this.type,
      workerScores: scores,
      breakdown: breakdowns,
      reason,
    };

    return { selectedWorker, decision };
  }
}
