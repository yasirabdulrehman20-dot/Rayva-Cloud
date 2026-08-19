import { JobQueue } from './JobQueue.js';
import { Job, JobType, JobPriority, JobStatus, JobPayload } from '../../shared/types.js';
import { dbService } from '../database/db.js';
import { logger } from '../monitoring/SystemLogger.js';

export class JobManager {
  private queue = new JobQueue();
  private jobsMap: Map<string, Job> = new Map();

  async resetAndReinit(): Promise<void> {
    this.jobsMap.clear();
    this.queue = new JobQueue();
    await this.init();
  }

  async init(): Promise<void> {
    const dbJobs = dbService.getJobs();
    if (dbJobs.length > 0) {
      dbJobs.forEach((job) => {
        if (!job.userId) {
          job.userId = 'usr-admin-default';
          job.submittedBy = 'Cluster Admin';
          dbService.saveJob(job);
        }
        this.jobsMap.set(job.id, job);
        if (job.status === 'QUEUED' || job.status === 'SCHEDULING' || job.status === 'RETRYING') {
          this.queue.enqueue(job);
        }
      });
      logger.info('JobManager', `Restored ${dbJobs.length} historical jobs from SQLite database`);
    }
  }

  public createJob(
    name: string,
    type: JobType,
    priority: JobPriority = 'NORMAL',
    payload: JobPayload = {},
    maxRetries = 3,
    userId?: string,
    submittedBy?: string
  ): Job {
    const ownerId = userId || 'usr-admin-default';
    const job: Job = {
      id: `job-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
      name: name || `${type.toLowerCase()}-task`,
      type,
      priority,
      status: 'QUEUED',
      submittedTime: Date.now(),
      retryCount: 0,
      maxRetries,
      payload,
      userId: ownerId,
      submittedBy: submittedBy || 'Cluster Admin',
    };

    this.jobsMap.set(job.id, job);
    this.queue.enqueue(job);
    dbService.saveJob(job);

    const owner = dbService.getUserById(ownerId);
    logger.info('JobManager', `Job submitted - ${job.id} - ${owner?.email || job.submittedBy || ownerId}`, {
      action: 'JOB_SUBMITTED',
      type: job.type,
      payload,
      userId: ownerId,
      userEmail: owner?.email,
      role: owner?.role,
      resourceId: job.id,
    });

    return job;
  }

  public getNextJob(): Job | undefined {
    return this.queue.dequeue();
  }

  public requeueJob(jobId: string): boolean {
    const job = this.jobsMap.get(jobId);
    if (!job || job.status === 'CANCELLED' || job.status === 'COMPLETED' || job.status === 'FAILED') {
      return false;
    }

    job.status = 'QUEUED';
    this.queue.remove(jobId);
    this.queue.enqueue(job);
    dbService.saveJob(job);
    return true;
  }

  public updateJob(job: Job): void {
    this.jobsMap.set(job.id, job);
    dbService.saveJob(job);
  }

  public cancelJob(jobId: string): boolean {
    const job = this.jobsMap.get(jobId);
    if (!job) return false;

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return false;
    }

    job.status = 'CANCELLED';
    this.queue.remove(jobId);
    dbService.saveJob(job);

    const owner = job.userId ? dbService.getUserById(job.userId) : null;
    logger.warn('JobManager', `Job cancelled - ${jobId} - ${owner?.email || job.submittedBy || job.userId || 'unknown user'}`, {
      action: 'JOB_CANCELLED',
      userId: job.userId,
      userEmail: owner?.email,
      role: owner?.role,
      resourceId: jobId,
    });
    return true;
  }

  public requeueJobForRetry(jobId: string, reason: string): boolean {
    const job = this.jobsMap.get(jobId);
    if (!job) return false;

    if (job.retryCount >= job.maxRetries) {
      job.status = 'FAILED';
      job.error = `Exceeded maximum retries (${job.maxRetries}). ${reason}`;
      dbService.saveJob(job);
      logger.error('JobManager', `Job #${jobId} failed permanently: ${job.error}`);
      return false;
    }

    job.retryCount++;
    job.status = 'RETRYING';
    job.error = `Retrying (${job.retryCount}/${job.maxRetries}): ${reason}`;
    this.queue.remove(jobId);
    this.queue.enqueue(job);
    dbService.saveJob(job);

    logger.warn('JobManager', `Requeued Job #${jobId} for retry attempt ${job.retryCount}/${job.maxRetries}`, {
      reason,
    });

    return true;
  }

  public getJob(id: string): Job | undefined {
    return this.jobsMap.get(id);
  }

  public getJobForUser(id: string, userId: string, isAdmin: boolean): Job | undefined {
    const job = this.jobsMap.get(id);
    if (!job) return undefined;
    if (isAdmin || job.userId === userId) {
      return job;
    }
    return undefined;
  }

  public getJobsForUser(userId: string): Job[] {
    return Array.from(this.jobsMap.values())
      .filter((j) => j.userId === userId)
      .sort((a, b) => b.submittedTime - a.submittedTime);
  }

  public cancelJobForUser(jobId: string, userId: string, isAdmin: boolean): boolean {
    const job = this.jobsMap.get(jobId);
    if (!job) return false;
    if (!isAdmin && job.userId !== userId) {
      return false;
    }
    return this.cancelJob(jobId);
  }

  public getAllJobs(): Job[] {
    return Array.from(this.jobsMap.values()).sort((a, b) => b.submittedTime - a.submittedTime);
  }

  public getQueueSize(): number {
    return this.queue.size();
  }
}

export const jobManager = new JobManager();
