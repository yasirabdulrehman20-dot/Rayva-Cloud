import { Job, JobPriority } from '../../shared/types.js';

const PRIORITY_ORDER: Record<JobPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

export class JobQueue {
  private queue: Job[] = [];

  public enqueue(job: Job): void {
    this.queue.push(job);
    this.sortQueue();
  }

  public dequeue(): Job | undefined {
    return this.queue.shift();
  }

  public peek(): Job | undefined {
    return this.queue[0];
  }

  public remove(jobId: string): boolean {
    const idx = this.queue.findIndex((j) => j.id === jobId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  public getQueuedJobs(): Job[] {
    return [...this.queue];
  }

  public size(): number {
    return this.queue.length;
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      const pA = PRIORITY_ORDER[a.priority] || 1;
      const pB = PRIORITY_ORDER[b.priority] || 1;
      if (pA !== pB) {
        return pB - pA; // Higher priority first
      }
      return a.submittedTime - b.submittedTime; // FIFO for same priority
    });
  }
}
