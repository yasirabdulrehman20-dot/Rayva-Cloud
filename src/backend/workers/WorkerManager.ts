import { WorkerNode } from './WorkerNode.js';
import { WorkerNodeData } from '../../shared/types.js';
import { dbService } from '../database/db.js';
import { logger } from '../monitoring/SystemLogger.js';

export class WorkerManager {
  private workers: Map<string, WorkerNode> = new Map();

  async resetAndReinit(): Promise<void> {
    this.workers.clear();
    await this.init();
  }

  async init(): Promise<void> {
    const dbWorkers = dbService.getWorkers();

    if (dbWorkers.length > 0) {
      dbWorkers.forEach((wd) => {
        let updatedName = wd.name;
        if (wd.id === 'worker-01' || wd.name.includes('Alpha') || wd.name.includes('alpha')) {
          updatedName = 'Rayva Titan';
        } else if (wd.id === 'worker-02' || wd.name.includes('Beta') || wd.name.includes('beta')) {
          updatedName = 'Rayva Vector';
        } else if (wd.id === 'worker-03' || wd.name.includes('Gamma') || wd.name.includes('gamma')) {
          updatedName = 'Rayva Flux';
        } else if (wd.id === 'worker-04' || wd.name.includes('Delta') || wd.name.includes('delta')) {
          updatedName = 'Rayva Edge';
        }

        const node = new WorkerNode(wd.id, updatedName, wd.host, wd.cpuCapacity, wd.ramCapacity);
        node.data = { ...wd, name: updatedName, scoreBreakdown: wd.scoreBreakdown || undefined };
        node.restoreForNewMainNode();
        this.workers.set(node.data.id, node);
        dbService.saveWorker(node.data);
      });
      logger.info('WorkerManager', `Loaded ${dbWorkers.length} worker nodes from database persistence`);
    } else {
      // Seed default cluster of 4 initial workers
      this.registerWorker(new WorkerNode('worker-01', 'Rayva Titan', '10.0.1.11', 8, 32768));
      this.registerWorker(new WorkerNode('worker-02', 'Rayva Vector', '10.0.1.12', 4, 16384));
      this.registerWorker(new WorkerNode('worker-03', 'Rayva Flux', '10.0.1.13', 8, 16384));
      this.registerWorker(new WorkerNode('worker-04', 'Rayva Edge', '10.0.1.14', 4, 8192));
      logger.info('WorkerManager', 'Initialized default 4-node worker cluster');
    }
  }

  public registerWorker(worker: WorkerNode): WorkerNode {
    worker.updateHeartbeat();
    this.workers.set(worker.data.id, worker);
    dbService.saveWorker(worker.data);
    logger.info('WorkerManager', `Registered new worker node: ${worker.data.name} (${worker.data.id})`);
    return worker;
  }

  public getAllWorkers(): WorkerNodeData[] {
    return Array.from(this.workers.values()).map((w) => {
      w.updateHeartbeat();
      dbService.saveWorker(w.data);
      return w.data;
    });
  }

  public getWorkerNode(id: string): WorkerNode | undefined {
    return this.workers.get(id);
  }

  public getWorkerData(id: string): WorkerNodeData | undefined {
    const w = this.workers.get(id);
    if (!w) return undefined;
    w.updateHeartbeat();
    dbService.saveWorker(w.data);
    return w.data;
  }

  public checkHeartbeats(staleThresholdMs = 12000): { failedWorkers: string[] } {
    const now = Date.now();
    const failedWorkers: string[] = [];

    this.workers.forEach((worker) => {
      if (worker.data.status === 'OFFLINE' || worker.data.status === 'FAILED') {
        return;
      }

      if (now - worker.data.lastHeartbeat > staleThresholdMs) {
        logger.warn('WorkerManager', `Worker ${worker.data.name} (${worker.data.id}) missed heartbeat timeout! Marking FAILED.`, {
          lastHeartbeatAgeMs: now - worker.data.lastHeartbeat,
        });
        worker.simulateFailure();
        failedWorkers.push(worker.data.id);
        dbService.saveWorker(worker.data);
      } else {
        worker.updateHeartbeat();
        dbService.saveWorker(worker.data);
      }
    });

    return { failedWorkers };
  }

  public simulateWorkerFailure(id: string): boolean {
    const worker = this.workers.get(id);
    if (!worker) return false;

    worker.simulateFailure();
    dbService.saveWorker(worker.data);
    logger.error('WorkerManager', `Simulated failure triggered on worker: ${worker.data.name} (${worker.data.id})`);
    return true;
  }

  public recoverWorker(id: string): boolean {
    const worker = this.workers.get(id);
    if (!worker) return false;

    worker.recover();
    dbService.saveWorker(worker.data);
    logger.info('WorkerManager', `Recovered worker: ${worker.data.name} (${worker.data.id})`);
    return true;
  }
}

export const workerManager = new WorkerManager();
