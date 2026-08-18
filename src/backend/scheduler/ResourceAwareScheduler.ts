import { ISchedulingStrategy } from './SchedulingStrategy.js';
import { Job, WorkerNodeData, SchedulerDecision, SchedulerStrategyType } from '../../shared/types.js';

export class ResourceAwareScheduler implements ISchedulingStrategy {
  readonly type: SchedulerStrategyType = 'RESOURCE_AWARE';
  readonly name = 'Resource-Aware Scheduler';
  readonly description = 'Selects workers using composite score evaluating CPU, RAM, active workload, success rate, and historical execution latency.';

  selectWorker(
    job: Job,
    workers: WorkerNodeData[]
  ): { selectedWorker: WorkerNodeData | null; decision: SchedulerDecision } {
    const available = workers.filter(
      (w) => w.status === 'IDLE' || w.status === 'BUSY' || w.status === 'ONLINE'
    );

    const scores: Record<string, number> = {};
    const breakdowns: Record<string, any> = {};

    let bestWorker: WorkerNodeData | null = null;
    let highestScore = -1;

    available.forEach((w) => {
      const score = w.score || 0;
      scores[w.id] = score;
      breakdowns[w.id] = {
        cpuAvail: `${100 - w.currentCpuUsage}%`,
        ramAvail: `${100 - w.currentRamUsage}%`,
        activeJobs: w.activeJobs,
        successRate: `${w.successRate}%`,
        avgExecutionTime: `${w.avgExecutionTimeMs}ms`,
        score,
        breakdown: w.scoreBreakdown,
      };

      if (score > highestScore) {
        highestScore = score;
        bestWorker = w;
      }
    });

    const timestamp = Date.now();
    let reason = '';

    if (bestWorker) {
      const bw: WorkerNodeData = bestWorker;
      reason = `Selected ${bw.name} (${bw.id}) with highest composite score ${highestScore.toFixed(1)}/100 (CPU avail: ${100 - bw.currentCpuUsage}%, RAM avail: ${100 - bw.currentRamUsage}%, Active Jobs: ${bw.activeJobs}, Success Rate: ${bw.successRate}%).`;
    } else {
      reason = 'No healthy workers online with adequate capacity.';
    }

    const decision: SchedulerDecision = {
      jobId: job.id,
      jobName: job.name,
      selectedWorkerId: bestWorker ? (bestWorker as WorkerNodeData).id : '',
      selectedWorkerName: bestWorker ? (bestWorker as WorkerNodeData).name : 'NONE',
      timestamp,
      strategyUsed: this.type,
      workerScores: scores,
      breakdown: breakdowns,
      reason,
    };

    return { selectedWorker: bestWorker, decision };
  }
}
