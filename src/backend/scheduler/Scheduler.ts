import { ISchedulingStrategy } from './SchedulingStrategy.js';
import { ResourceAwareScheduler } from './ResourceAwareScheduler.js';
import { RoundRobinScheduler } from './RoundRobinScheduler.js';
import { LeastLoadedScheduler } from './LeastLoadedScheduler.js';
import { PriorityScheduler } from './PriorityScheduler.js';
import { PredictiveScheduler } from './PredictiveScheduler.js';
import { Job, WorkerNodeData, SchedulerDecision, SchedulerStrategyType } from '../../shared/types.js';
import { dbService } from '../database/db.js';
import { logger } from '../monitoring/SystemLogger.js';

export class Scheduler {
  private strategies: Map<SchedulerStrategyType, ISchedulingStrategy> = new Map();
  private activeStrategyType: SchedulerStrategyType = 'RESOURCE_AWARE';

  constructor() {
    this.registerStrategy(new ResourceAwareScheduler());
    this.registerStrategy(new RoundRobinScheduler());
    this.registerStrategy(new LeastLoadedScheduler());
    this.registerStrategy(new PriorityScheduler());
    this.registerStrategy(new PredictiveScheduler());

    // Restore strategy from DB if saved
    const saved = dbService.getConfig('active_scheduler_strategy');
    if (saved && this.strategies.has(saved as SchedulerStrategyType)) {
      this.activeStrategyType = saved as SchedulerStrategyType;
    }
  }

  public registerStrategy(strategy: ISchedulingStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  public setStrategy(strategyType: SchedulerStrategyType): boolean {
    if (!this.strategies.has(strategyType)) {
      return false;
    }
    this.activeStrategyType = strategyType;
    dbService.saveConfig('active_scheduler_strategy', strategyType);
    const active = this.strategies.get(strategyType);
    logger.info('Scheduler', `Switched active scheduling strategy to: ${active?.name} (${strategyType})`);
    return true;
  }

  public getActiveStrategyType(): SchedulerStrategyType {
    return this.activeStrategyType;
  }

  public getAvailableStrategies(): { type: SchedulerStrategyType; name: string; description: string }[] {
    return Array.from(this.strategies.values()).map((s) => ({
      type: s.type,
      name: s.name,
      description: s.description,
    }));
  }

  public scheduleJob(
    job: Job,
    workers: WorkerNodeData[]
  ): { selectedWorker: WorkerNodeData | null; decision: SchedulerDecision } {
    const strategy = this.strategies.get(this.activeStrategyType) || this.strategies.get('RESOURCE_AWARE')!;

    logger.info('Scheduler', `Evaluating ${workers.length} worker nodes for Job #${job.id} using strategy [${strategy.type}]`);

    const result = strategy.selectWorker(job, workers);

    // Save decision to DB & log
    dbService.saveSchedulerDecision(result.decision);

    if (result.selectedWorker) {
      logger.info('Scheduler', `Job #${job.id} matched to ${result.selectedWorker.name} (${result.selectedWorker.id})`, {
        decisionReason: result.decision.reason,
      });
    } else {
      logger.warn('Scheduler', `Job #${job.id} could not be matched to any worker node. Job will remain in queue.`);
    }

    return result;
  }

  public getRecentDecisions(): SchedulerDecision[] {
    return dbService.getSchedulerDecisions();
  }
}

export const scheduler = new Scheduler();
