import { ISchedulingStrategy } from './SchedulingStrategy.js';
import { Job, WorkerNodeData, SchedulerDecision, SchedulerStrategyType } from '../../shared/types.js';

/**
 * PredictiveScheduler (Future AI / Machine Learning Scheduler Abstraction)
 *
 * Implements statistical execution forecast heuristics using historical job metrics
 * and worker failure probabilities, structured as an extensible model inference pipeline.
 */
export class PredictiveScheduler implements ISchedulingStrategy {
  readonly type: SchedulerStrategyType = 'PREDICTIVE_AI';
  readonly name = 'Predictive AI Scheduler (ML Pipeline)';
  readonly description = 'Uses historical execution telemetry, predicted CPU/RAM profiles, and worker fault probability models to select optimal placement.';

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

    available.forEach((w) => {
      // Feature extraction & regression heuristic predictions
      const predictedExecutionTimeMs = Math.round(w.avgExecutionTimeMs * (1 + w.activeJobs * 0.2));
      const predictedCpuSurge = Math.min(100, w.currentCpuUsage + 25);
      const predictedRamSurge = Math.min(100, w.currentRamUsage + 20);
      const predictedFailureProbability = Math.round((100 - w.successRate) * 0.8 + (w.failedJobs > 2 ? 15 : 0));

      // Placement score based on predictive regression features
      const score = Math.max(
        0,
        Math.round(
          (100 - predictedFailureProbability) * 0.35 +
            (100 - predictedCpuSurge) * 0.25 +
            (100 - predictedRamSurge) * 0.25 +
            (20000 / (predictedExecutionTimeMs + 500)) * 0.15
        )
      );

      scores[w.id] = score;
      breakdowns[w.id] = {
        predictedExecutionTimeMs: `${predictedExecutionTimeMs}ms`,
        predictedCpuSurge: `${predictedCpuSurge}%`,
        predictedRamSurge: `${predictedRamSurge}%`,
        predictedFailureProb: `${predictedFailureProbability}%`,
        mlInferenceScore: score,
      };

      if (score > highestScore) {
        highestScore = score;
        selectedWorker = w;
      }
    });

    const timestamp = Date.now();
    const reason = selectedWorker
      ? `Predictive ML model assigned Job #${job.id} to ${selectedWorker.name} (Predicted runtime: ${breakdowns[selectedWorker.id].predictedExecutionTimeMs}, Failure risk: ${breakdowns[selectedWorker.id].predictedFailureProb}).`
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
