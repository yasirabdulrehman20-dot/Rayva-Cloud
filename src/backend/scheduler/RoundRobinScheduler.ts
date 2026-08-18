import { ISchedulingStrategy } from './SchedulingStrategy.js';
import { Job, WorkerNodeData, SchedulerDecision, SchedulerStrategyType } from '../../shared/types.js';

export class RoundRobinScheduler implements ISchedulingStrategy {
  readonly type: SchedulerStrategyType = 'ROUND_ROBIN';
  readonly name = 'Round-Robin Scheduler';
  readonly description = 'Sequentially distributes jobs across available workers in cyclic order.';

  private lastIndex = 0;

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

    if (available.length > 0) {
      this.lastIndex = (this.lastIndex + 1) % available.length;
      selectedWorker = available[this.lastIndex];
    }

    available.forEach((w, index) => {
      const isSelected = selectedWorker && w.id === selectedWorker.id;
      scores[w.id] = isSelected ? 100 : 50;
      breakdowns[w.id] = {
        queuePosition: index,
        selected: isSelected,
        activeJobs: w.activeJobs,
      };
    });

    const timestamp = Date.now();
    const reason = selectedWorker
      ? `Selected ${selectedWorker.name} via cyclic round-robin index ${this.lastIndex}/${available.length}.`
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
