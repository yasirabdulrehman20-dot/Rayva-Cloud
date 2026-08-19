import { WorkerNodeData, WorkerStatus, WorkerScoreBreakdown } from '../../shared/types.js';

export class WorkerNode {
  public data: WorkerNodeData;

  constructor(
    id: string,
    name: string,
    host = '10.0.1.' + Math.floor(Math.random() * 200 + 10),
    cpuCapacity = 4,
    ramCapacity = 16384
  ) {
    this.data = {
      id,
      name,
      host,
      cpuCapacity,
      currentCpuUsage: 12 + Math.floor(Math.random() * 15),
      ramCapacity,
      currentRamUsage: 20 + Math.floor(Math.random() * 15),
      currentWorkload: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      avgExecutionTimeMs: 1200,
      successRate: 100,
      status: 'IDLE',
      lastHeartbeat: Date.now(),
      score: 90,
    };
  }

  public updateHeartbeat(): void {
    this.data.lastHeartbeat = Date.now();
    if (this.data.status === 'OFFLINE' || this.data.status === 'FAILED') {
      // Don't override failed status via normal heartbeat unless explicitly recovered
      return;
    }

    // Dynamic resource fluctuation for real-feel metrics
    if (this.data.activeJobs > 0) {
      this.data.currentCpuUsage = Math.min(98, 45 + this.data.activeJobs * 25 + Math.floor(Math.random() * 10));
      this.data.currentRamUsage = Math.min(95, 35 + this.data.activeJobs * 18 + Math.floor(Math.random() * 10));
      this.data.currentWorkload = Math.min(100, this.data.activeJobs * 33 + Math.floor(Math.random() * 10));
      this.data.status = 'BUSY';
    } else {
      this.data.currentCpuUsage = Math.max(5, 10 + Math.floor(Math.random() * 8));
      this.data.currentRamUsage = Math.max(15, 20 + Math.floor(Math.random() * 5));
      this.data.currentWorkload = 0;
      this.data.status = 'IDLE';
    }

    this.recalculateScore();
  }

  public restoreForNewMainNode(): void {
    this.data.status = 'IDLE';
    this.data.activeJobs = 0;
    this.data.currentCpuUsage = 0;
    this.data.currentRamUsage = 0;
    this.data.currentWorkload = 0;
    this.updateHeartbeat();
  }

  public recalculateScore(): WorkerScoreBreakdown {
    // 1. CPU availability score (0..100)
    const cpuAvailScore = Math.max(0, 100 - this.data.currentCpuUsage);

    // 2. RAM availability score (0..100)
    const ramAvailScore = Math.max(0, 100 - this.data.currentRamUsage);

    // 3. Workload score (0..100, 100 is low workload)
    const workloadScore = Math.max(0, 100 - this.data.currentWorkload);

    // 4. Active jobs penalty (0..100, 100 means 0 active jobs)
    const activeJobsScore = Math.max(0, 100 - this.data.activeJobs * 25);

    // 5. Success rate score (0..100)
    const successRateScore = this.data.successRate;

    // 6. Performance score based on execution speed (0..100)
    // baseline ~ 1000ms = 80 pts
    const perfScore = Math.min(100, Math.max(10, Math.round(50000 / (this.data.avgExecutionTimeMs + 200))));

    const breakdown: WorkerScoreBreakdown = {
      cpuAvailabilityScore: Math.round(cpuAvailScore),
      ramAvailabilityScore: Math.round(ramAvailScore),
      workloadScore: Math.round(workloadScore),
      activeJobsScore: Math.round(activeJobsScore),
      successRateScore: Math.round(successRateScore),
      perfScore: Math.round(perfScore),
    };

    if (this.data.status === 'OFFLINE' || this.data.status === 'FAILED' || this.data.status === 'MAINTENANCE') {
      this.data.score = 0;
    } else {
      // Weighted sum formula
      const rawScore =
        cpuAvailScore * 0.25 +
        ramAvailScore * 0.20 +
        workloadScore * 0.20 +
        activeJobsScore * 0.15 +
        successRateScore * 0.12 +
        perfScore * 0.08;

      this.data.score = Math.round(rawScore * 10) / 10;
    }

    this.data.scoreBreakdown = breakdown;
    return breakdown;
  }

  public recordJobCompletion(executionTimeMs: number): void {
    this.data.activeJobs = Math.max(0, this.data.activeJobs - 1);
    this.data.completedJobs++;

    // Exponential moving average for runtime
    if (this.data.avgExecutionTimeMs === 0) {
      this.data.avgExecutionTimeMs = executionTimeMs;
    } else {
      this.data.avgExecutionTimeMs = Math.round(
        this.data.avgExecutionTimeMs * 0.7 + executionTimeMs * 0.3
      );
    }

    const totalFinished = this.data.completedJobs + this.data.failedJobs;
    this.data.successRate = Math.round((this.data.completedJobs / totalFinished) * 100);

    this.updateHeartbeat();
  }

  public recordJobFailure(): void {
    this.data.activeJobs = Math.max(0, this.data.activeJobs - 1);
    this.data.failedJobs++;

    const totalFinished = this.data.completedJobs + this.data.failedJobs;
    this.data.successRate = Math.round((this.data.completedJobs / totalFinished) * 100);

    this.updateHeartbeat();
  }

  public simulateFailure(): void {
    this.data.status = 'FAILED';
    this.data.currentCpuUsage = 0;
    this.data.currentRamUsage = 0;
    this.data.currentWorkload = 0;
    this.data.score = 0;
  }

  public recover(): void {
    this.data.status = 'IDLE';
    this.data.lastHeartbeat = Date.now();
    this.updateHeartbeat();
  }
}
