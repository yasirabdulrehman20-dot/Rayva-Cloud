import { ISchedulingStrategy } from './SchedulingStrategy.js';
import { Job, WorkerNodeData, SchedulerDecision, SchedulerStrategyType } from '../../shared/types.js';

export class PriorityScheduler implements ISchedulingStrategy {
  readonly type: SchedulerStrategyType = 'PRIORITY';
  readonly name = 'Priority-Driven Scheduler';
  readonly description = 'Prioritizes CRITICAL and HIGH priority jobs by reserving or directing them to high-spec workers with highest CPU head-room.';

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
    let highestScore = -1;

    // Is it CRITICAL or HIGH priority?
    const isHighPriority = job.priority === 'CRITICAL' || job.priority === 'HIGH';

    available.forEach((w) => {
      // Weight CPU cores and CPU availability heavily for high priority tasks
      const cpuWeight = isHighPriority ? 0.5 : 0.25;
      const coreCapacityBonus = (w.cpuCapacity / 16) * 100;
      const cpuHeadroom = 100 - w.currentCpuUsage;

      const score = Math.round(
        cpuHeadroom * cpuWeight +
          (100 - w.currentRamUsage) * 0.25 +
          coreCapacityBonus * 0.25 +
          (w.successRate) * 0.25
      );

      scores[w.id] = score;
      breakdowns[w.id] = {
        jobPriority: job.priority,
        cpuCores: w.cpuCapacity,
        cpuHeadroom: `${cpuHeadroom}%`,
        score,
      };

      if (score > highestScore) {
        highestScore = score;
        selectedWorker = w;
      }
    });

    const timestamp = Date.now();
    const reason = selectedWorker
      ? `Priority-matched Job #${job.id} (${job.priority}) to high-spec worker ${selectedWorker.name} (${selectedWorker.cpuCapacity} Cores, ${100 - selectedWorker.currentCpuUsage}% CPU headroom).`
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
