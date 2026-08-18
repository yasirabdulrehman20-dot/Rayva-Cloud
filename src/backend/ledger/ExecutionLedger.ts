import crypto from 'crypto';
import { ExecutionRecord, Job } from '../../shared/types.js';
import { dbService } from '../database/db.js';
import { logger } from '../monitoring/SystemLogger.js';

export interface IExecutionLedger {
  recordJobExecution(
    job: Job,
    workerId: string,
    workerName: string,
    inputHash: string,
    resultHash: string,
    executionTimeMs: number
  ): Promise<ExecutionRecord>;

  getRecords(): ExecutionRecord[];
  verifyChainIntegrity(): { valid: boolean; recordCount: number; errors: string[] };
}

export class DatabaseExecutionLedger implements IExecutionLedger {
  private getLatestRecordHash(): string {
    const rawRecords = dbService.getExecutionLedger();
    if (rawRecords.length === 0) {
      return '0000000000000000000000000000000000000000000000000000000000000000';
    }

    // Find the record whose currentRecordHash is NOT referenced as any other record's prevRecordHash (the chain tip)
    const prevHashes = new Set(rawRecords.map((r) => r.prevRecordHash));
    const tipCandidates = rawRecords.filter((r) => !prevHashes.has(r.currentRecordHash));

    if (tipCandidates.length === 1) {
      return tipCandidates[0].currentRecordHash;
    }

    // Fallback: newest by timestamp
    const sorted = [...rawRecords].sort((a, b) => a.timestamp - b.timestamp);
    return sorted[sorted.length - 1].currentRecordHash;
  }

  async recordJobExecution(
    job: Job,
    workerId: string,
    workerName: string,
    inputHash: string,
    resultHash: string,
    executionTimeMs: number
  ): Promise<ExecutionRecord> {
    const timestamp = Date.now();
    const prevRecordHash = this.getLatestRecordHash();

    const payloadToHash = `${job.id}|${workerId}|${timestamp}|${inputHash}|${resultHash}|${prevRecordHash}`;
    const currentRecordHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const record: ExecutionRecord = {
      recordId: `ledger-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
      jobId: job.id,
      jobName: job.name,
      workerId,
      workerName,
      timestamp,
      inputHash,
      resultHash,
      prevRecordHash,
      currentRecordHash,
      executionTimeMs,
      status: job.status,
    };

    dbService.saveExecutionRecord(record);

    logger.info('ExecutionLedger', `Logged verifiable execution record for Job #${job.id}`, {
      recordId: record.recordId,
      currentHash: currentRecordHash.substring(0, 12),
      prevHash: prevRecordHash.substring(0, 12),
    });

    return record;
  }

  getRecords(): ExecutionRecord[] {
    return dbService.getExecutionLedger();
  }

  verifyChainIntegrity(): { valid: boolean; recordCount: number; errors: string[] } {
    const rawRecords = dbService.getExecutionLedger();
    if (rawRecords.length === 0) {
      return { valid: true, recordCount: 0, errors: [] };
    }

    const errors: string[] = [];

    // 1. First build hash maps to accurately trace and reconstruct the exact cryptographic chain graph
    const hashToRecord = new Map<string, ExecutionRecord>();
    const prevHashToRecord = new Map<string, ExecutionRecord>();

    for (const r of rawRecords) {
      hashToRecord.set(r.currentRecordHash, r);
      prevHashToRecord.set(r.prevRecordHash, r);
    }

    // 2. Reconstruct contiguous cryptographic chain segments
    // A chain root is any record whose prevRecordHash does not exist as another record's currentRecordHash
    const rootCandidates = rawRecords.filter((r) => !hashToRecord.has(r.prevRecordHash));

    // Sort roots chronologically
    rootCandidates.sort((a, b) => a.timestamp - b.timestamp);

    const visited = new Set<string>();
    const chain: ExecutionRecord[] = [];

    // Traverse each segment from root to tip
    for (const root of rootCandidates) {
      let current: ExecutionRecord | undefined = root;
      while (current && !visited.has(current.recordId)) {
        chain.push(current);
        visited.add(current.recordId);
        current = prevHashToRecord.get(current.currentRecordHash);
      }
    }

    // Append any unvisited records (orphans / disjointed) sorted by timestamp
    if (chain.length < rawRecords.length) {
      const remaining = rawRecords
        .filter((r) => !visited.has(r.recordId))
        .sort((a, b) => a.timestamp - b.timestamp);
      chain.push(...remaining);
    }

    // 3. Authenticate and cryptographically verify each record in chain order
    for (let i = 0; i < chain.length; i++) {
      const r = chain[i];

      // A. Verify individual record hash integrity (tamper detection)
      const payload = `${r.jobId}|${r.workerId}|${r.timestamp}|${r.inputHash}|${r.resultHash}|${r.prevRecordHash}`;
      const calculatedHash = crypto.createHash('sha256').update(payload).digest('hex');

      if (calculatedHash !== r.currentRecordHash) {
        errors.push(
          `Record ${r.recordId} (Job ${r.jobId}) tampered/corrupted! Calculated hash ${calculatedHash.substring(0, 12)} does not match recorded ${r.currentRecordHash.substring(0, 12)}.`
        );
      }

      // B. Verify cryptographic chain linkage against predecessor
      // If a record points to a previous record in this chain, verify exact match
      if (r.prevRecordHash !== '0000000000000000000000000000000000000000000000000000000000000000') {
        const referencedPredecessor = hashToRecord.get(r.prevRecordHash);
        if (!referencedPredecessor) {
          errors.push(
            `Record ${r.recordId} broken link: prevRecordHash (${r.prevRecordHash.substring(0, 12)}) does not reference any valid record in ledger history.`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      recordCount: chain.length,
      errors,
    };
  }
}

export const executionLedger = new DatabaseExecutionLedger();
