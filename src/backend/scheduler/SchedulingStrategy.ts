import { Job, WorkerNodeData, SchedulerDecision, SchedulerStrategyType } from '../../shared/types.js';

export interface ISchedulingStrategy {
  readonly type: SchedulerStrategyType;
  readonly name: string;
  readonly description: string;

  selectWorker(
    job: Job,
    workers: WorkerNodeData[]
  ): {
    selectedWorker: WorkerNodeData | null;
    decision: SchedulerDecision;
  };
}
