import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Job, WorkerNodeData, SchedulerDecision, ExecutionRecord, SystemLog } from '../../shared/types.js';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (!storedHash.includes(':')) {
    // Fallback comparison for legacy unhashed entries, auto-upgradeable
    return password === storedHash;
  }
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

class DatabaseService {
  private db: SqlJsDatabase | null = null;
  private dbPath: string = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR, 'rayva_cloud_db.sqlite')
    : path.resolve(process.cwd(), 'rayva_cloud_db.sqlite');
  private legacyDbPath: string = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR, 'minicloud_db.sqlite')
    : path.resolve(process.cwd(), 'minicloud_db.sqlite');
  private backupDir: string = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR, 'backups')
    : path.resolve(process.cwd(), 'backups');

  async init(): Promise<void> {
    const parentDir = path.dirname(this.dbPath);
    if (!fs.existsSync(parentDir)) {
      try {
        fs.mkdirSync(parentDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create database directory:', err);
      }
    }

    const SQL = await initSqlJs();

    let isLoaded = false;

    // Migrate legacy minicloud_db.sqlite if rayva_cloud_db.sqlite does not exist
    if (!fs.existsSync(this.dbPath) && fs.existsSync(this.legacyDbPath)) {
      try {
        fs.copyFileSync(this.legacyDbPath, this.dbPath);
        console.log('Migrated legacy database file to rayva_cloud_db.sqlite');
      } catch (err) {
        console.warn('Failed to copy legacy database file:', err);
      }
    }

    if (fs.existsSync(this.dbPath)) {
      try {
        const filebuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(new Uint8Array(filebuffer.buffer, filebuffer.byteOffset, filebuffer.byteLength));
        // Test database integrity by running table creation/verification
        this.createTables();
        isLoaded = true;
      } catch (err) {
        console.error('Failed to load or validate existing SQLite database file, attempting recovery:', err);
        if (this.db) {
          try {
            this.db.close();
          } catch (_) {}
          this.db = null;
        }
        // Move corrupt file so it doesn't block restart
        this.ensureBackupDir();
        try {
          const corruptBackup = path.join(this.backupDir, `corrupt_rayva_cloud_db_${Date.now()}.sqlite`);
          fs.renameSync(this.dbPath, corruptBackup);
          console.warn(`Moved malformed SQLite database file to backup directory: ${corruptBackup}`);
        } catch (_) {
          try {
            fs.unlinkSync(this.dbPath);
          } catch (e) {
            console.error('Unable to delete corrupt database file:', e);
          }
        }
      }
    }

    if (!isLoaded) {
      this.db = new SQL.Database();
      this.createTables();
      this.saveToDisk();
    }

    this.restoreHistoricalDataIfMissing();
  }

  private restoreHistoricalDataIfMissing(): void {
    if (!this.db) return;
    const currentJobs = this.getJobs();
    if (currentJobs.length > 0) {
      return; // Jobs already exist in active database
    }

    const backups = this.getBackups();
    if (backups.length === 0) return;

    for (const b of backups) {
      try {
        if (!fs.existsSync(b.path)) continue;
        const data = fs.readFileSync(b.path);

        const jobsFound: Map<string, any> = new Map();
        let pos = 0;
        while (true) {
          const idx = data.indexOf('{"id":"job-', pos);
          if (idx === -1) break;
          for (let len = 20; len < 5000; len++) {
            if (idx + len > data.length) break;
            if (data[idx + len - 1] === 125) { // '}'
              try {
                const slice = data.subarray(idx, idx + len).toString('utf-8');
                const parsed = JSON.parse(slice);
                if (parsed && typeof parsed === 'object' && parsed.id && parsed.id.startsWith('job-')) {
                  jobsFound.set(parsed.id, parsed);
                }
              } catch (_) {}
            }
          }
          pos = idx + 1;
        }

        const ledgerFound: Map<string, any> = new Map();
        pos = 0;
        while (true) {
          const idx = data.indexOf('{"recordId":', pos);
          if (idx === -1) break;
          for (let len = 20; len < 5000; len++) {
            if (idx + len > data.length) break;
            if (data[idx + len - 1] === 125) { // '}'
              try {
                const slice = data.subarray(idx, idx + len).toString('utf-8');
                const parsed = JSON.parse(slice);
                if (parsed && typeof parsed === 'object' && parsed.recordId) {
                  ledgerFound.set(parsed.recordId, parsed);
                }
              } catch (_) {}
            }
          }
          pos = idx + 1;
        }

        if (jobsFound.size > 0 || ledgerFound.size > 0) {
          console.log(`[DATA RECOVERY] Found ${jobsFound.size} historical jobs and ${ledgerFound.size} ledger records in backup: ${b.filename}`);
          
          for (const [jid, job] of jobsFound.entries()) {
            if (!job.userId) {
              job.userId = 'usr-admin-default';
              job.submittedBy = 'Cluster Admin';
            }
            this.saveJob(job);
          }

          for (const [rid, rec] of ledgerFound.entries()) {
            this.saveExecutionRecord(rec);
          }

          console.log(`[DATA RECOVERY] Successfully recovered ${jobsFound.size} jobs and ${ledgerFound.size} ledger entries into active database.`);
          break;
        }
      } catch (err) {
        console.warn(`[DATA RECOVERY] Attempted recovery from backup ${b.filename} failed:`, err);
      }
    }
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create backup directory:', err);
      }
    }
  }

  public checkIntegrity(): { healthy: boolean; status: 'HEALTHY' | 'CORRUPT' | 'NO_DB'; message: string; details?: string } {
    if (!fs.existsSync(this.dbPath)) {
      return { healthy: false, status: 'NO_DB', message: 'Database file does not exist on disk.' };
    }

    if (!this.db) {
      return { healthy: false, status: 'CORRUPT', message: 'Database handle is uninitialized or null.' };
    }

    try {
      // Execute PRAGMA integrity_check
      const res = this.db.exec('PRAGMA integrity_check;');
      if (res.length > 0 && res[0].values.length > 0) {
        const val = String(res[0].values[0][0]);
        if (val === 'ok') {
          // Verify basic table querying
          const userCount = this.db.exec('SELECT count(*) FROM users;');
          return {
            healthy: true,
            status: 'HEALTHY',
            message: 'Database integrity check passed (PRAGMA integrity_check: ok).',
            details: `Table verification successful. Active users count: ${userCount[0]?.values[0]?.[0] || 0}`,
          };
        }
        return { healthy: false, status: 'CORRUPT', message: `Integrity check reported issues: ${val}` };
      }
      return { healthy: false, status: 'CORRUPT', message: 'PRAGMA integrity_check produced no output.' };
    } catch (err: any) {
      return {
        healthy: false,
        status: 'CORRUPT',
        message: 'SQLite database query failed due to file corruption or malformed structure.',
        details: err?.message || String(err),
      };
    }
  }

  public getBackups(): Array<{ filename: string; path: string; sizeBytes: number; createdAt: string }> {
    this.ensureBackupDir();
    const backups: Array<{ filename: string; path: string; sizeBytes: number; createdAt: string }> = [];

    // Check backups folder
    if (fs.existsSync(this.backupDir)) {
      try {
        const files = fs.readdirSync(this.backupDir);
        files.forEach((file) => {
          const filePath = path.join(this.backupDir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              backups.push({
                filename: file,
                path: filePath,
                sizeBytes: stat.size,
                createdAt: new Date(stat.birthtimeMs || stat.mtimeMs).toISOString(),
              });
            }
          } catch (_) {}
        });
      } catch (_) {}
    }

    // Check process root for any old loose .corrupt files
    try {
      const rootFiles = fs.readdirSync(process.cwd());
      rootFiles.forEach((file) => {
        if (file.includes('rayva_cloud_db') || file.includes('minicloud_db.sqlite.corrupt')) {
          const filePath = path.join(process.cwd(), file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              backups.push({
                filename: file,
                path: filePath,
                sizeBytes: stat.size,
                createdAt: new Date(stat.birthtimeMs || stat.mtimeMs).toISOString(),
              });
            }
          } catch (_) {}
        }
      });
    } catch (_) {}

    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getDatabaseStatus() {
    const integrity = this.checkIntegrity();
    let sizeBytes = 0;
    let exists = false;

    if (fs.existsSync(this.dbPath)) {
      exists = true;
      try {
        const stat = fs.statSync(this.dbPath);
        sizeBytes = stat.size;
      } catch (_) {}
    }

    const backups = this.getBackups();

    return {
      dbPath: this.dbPath,
      exists,
      sizeBytes,
      status: integrity.status,
      healthy: integrity.healthy,
      message: integrity.message,
      details: integrity.details,
      backupCount: backups.length,
      backups,
    };
  }

  public async recoverAndReinitialize(): Promise<{
    success: boolean;
    backupPath: string | null;
    message: string;
    timestamp: number;
    backupsCount: number;
  }> {
    this.ensureBackupDir();
    let backupCreatedPath: string | null = null;

    // 1. Close current db safely
    if (this.db) {
      try {
        this.db.close();
      } catch (err) {
        console.warn('Error closing SQLite DB during recovery:', err);
      }
      this.db = null;
    }

    const timestamp = Date.now();

    // 2. Move existing database file to backup directory
    if (fs.existsSync(this.dbPath)) {
      try {
        const backupFileName = `db_backup_${timestamp}.sqlite`;
        backupCreatedPath = path.join(this.backupDir, backupFileName);
        fs.renameSync(this.dbPath, backupCreatedPath);
        console.log(`Database recovery: moved existing database to ${backupCreatedPath}`);
      } catch (err) {
        console.error('Database recovery: error moving corrupt database file, attempting copy and delete:', err);
        try {
          const backupFileName = `db_backup_${timestamp}.sqlite`;
          backupCreatedPath = path.join(this.backupDir, backupFileName);
          fs.copyFileSync(this.dbPath, backupCreatedPath);
          fs.unlinkSync(this.dbPath);
        } catch (e2) {
          console.error('Failed fallback copy/unlink during DB recovery:', e2);
        }
      }
    }

    // Move any temporary files
    const tmpPath = `${this.dbPath}.tmp`;
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}
    }

    // Move any loose corrupt files in process root to backups/
    try {
      const rootFiles = fs.readdirSync(process.cwd());
      rootFiles.forEach((file) => {
        if (file.includes('rayva_cloud_db') && file.includes('corrupt') || file.includes('minicloud_db.sqlite.corrupt')) {
          const src = path.join(process.cwd(), file);
          const dest = path.join(this.backupDir, file);
          try {
            fs.renameSync(src, dest);
          } catch (_) {}
        }
      });
    } catch (_) {}

    // 3. Re-initialize a clean fresh database
    await this.init();

    const totalBackups = this.getBackups().length;

    return {
      success: true,
      backupPath: backupCreatedPath ? path.relative(process.cwd(), backupCreatedPath) : null,
      message: 'Database moved to backup directory and re-initialized cleanly with default schema and admin user.',
      timestamp,
      backupsCount: totalBackups,
    };
  }

  private saveToDisk(): void {
    if (!this.db) return;
    try {
      const parentDir = path.dirname(this.dbPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const tmpPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, this.dbPath);
    } catch (err) {
      console.error('Failed to save SQLite DB to disk:', err);
    }
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scheduler_decisions (
        job_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS execution_ledger (
        record_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        email_verified INTEGER DEFAULT 0,
        email_verification_token_hash TEXT,
        email_verification_expires INTEGER,
        reset_token TEXT,
        reset_token_expires INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);

    // Run safe migration for existing databases missing email verification columns
    try {
      const tableInfo = this.db.exec("PRAGMA table_info(users);");
      if (tableInfo.length > 0 && tableInfo[0].values) {
        const columns = tableInfo[0].values.map((col) => String(col[1]));
        if (!columns.includes('email_verified')) {
          this.db.run('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1;');
          this.db.run('UPDATE users SET email_verified = 1 WHERE email_verified IS NULL;');
        }
        if (!columns.includes('email_verification_token_hash')) {
          this.db.run('ALTER TABLE users ADD COLUMN email_verification_token_hash TEXT;');
        }
        if (!columns.includes('email_verification_expires')) {
          this.db.run('ALTER TABLE users ADD COLUMN email_verification_expires INTEGER;');
        }
      }
    } catch (migErr) {
      console.warn('Notice: Migration check for users table completed or column already exists:', migErr);
    }

    this.seedDefaultUser();
  }

  private seedDefaultUser(): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`SELECT count(*) FROM users`);
    if (stmt.step()) {
      const count = stmt.get()[0] as number;
      stmt.free();
      if (count === 0) {
        const initialPassword = process.env.RAYVA_ADMIN_PASSWORD;
        if (!initialPassword || initialPassword.trim().length === 0) {
          console.error(
            '[FATAL CONFIGURATION ERROR] Cannot initialize fresh cluster admin account: RAYVA_ADMIN_PASSWORD environment variable is missing or empty. Please set RAYVA_ADMIN_PASSWORD to seed the initial admin account securely.'
          );
          throw new Error(
            'RAYVA_ADMIN_PASSWORD environment variable is required to initialize the default admin account (admin@rayva.io).'
          );
        }

        const insertStmt = this.db.prepare(
          `INSERT INTO users (id, email, name, password, role, email_verified, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`
        );
        const adminPasswordHash = hashPassword(initialPassword.trim());
        insertStmt.run(['usr-admin-default', 'admin@rayva.io', 'SysAdmin Lead', adminPasswordHash, 'Cluster Admin', Date.now()]);
        insertStmt.free();
        console.log('Successfully initialized initial admin account (admin@rayva.io) using RAYVA_ADMIN_PASSWORD.');
      }
    } else {
      stmt.free();
    }
  }

  // --- User / Auth Ops ---
  createUser(user: {
    id: string;
    email: string;
    name: string;
    password: string;
    role: string;
    emailVerified?: number;
    verificationTokenHash?: string | null;
    verificationExpires?: number | null;
  }): void {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }
    const stmt = this.db.prepare(
      `INSERT INTO users (id, email, name, password, role, email_verified, email_verification_token_hash, email_verification_expires, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    try {
      const hashedPassword = hashPassword(user.password);
      const isVerified = user.emailVerified !== undefined ? user.emailVerified : 0;
      stmt.run([
        user.id,
        user.email.toLowerCase().trim(),
        user.name.trim(),
        hashedPassword,
        user.role,
        isVerified,
        user.verificationTokenHash || null,
        user.verificationExpires || null,
        Date.now(),
      ]);
    } finally {
      stmt.free();
    }
    this.saveToDisk();
  }

  getAllUsersSanitized(): Array<{ id: string; role: string; email_verified: number }> {
    if (!this.db) return [];
    const res = this.db.exec(`SELECT id, role, email_verified FROM users ORDER BY created_at ASC`);
    if (res.length === 0) return [];
    return res[0].values.map((row) => ({
      id: row[0] as string,
      role: row[1] as string,
      email_verified: Number(row[2]),
    }));
  }

  // --- Session Ops ---
  createSession(userId: string, token: string, ttlMs = 7 * 24 * 60 * 60 * 1000): void {
    if (!this.db) return;
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO user_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
    );
    stmt.run([token, userId, now, expiresAt]);
    stmt.free();
    this.saveToDisk();
  }

  getSession(token: string): { token: string; user_id: string; created_at: number; expires_at: number } | null {
    if (!this.db || !token) return null;
    const stmt = this.db.prepare(
      `SELECT token, user_id, created_at, expires_at FROM user_sessions WHERE token = ?`
    );
    stmt.bind([token]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      const expiresAt = row[3] as number;
      if (Date.now() > expiresAt) {
        this.deleteSession(token);
        return null;
      }
      return {
        token: row[0] as string,
        user_id: row[1] as string,
        created_at: row[2] as number,
        expires_at: expiresAt,
      };
    }
    stmt.free();
    return null;
  }

  deleteSession(token: string): void {
    if (!this.db || !token) return;
    const stmt = this.db.prepare(`DELETE FROM user_sessions WHERE token = ?`);
    stmt.run([token]);
    stmt.free();
    this.saveToDisk();
  }

  deleteUserSessions(userId: string): void {
    if (!this.db || !userId) return;
    const stmt = this.db.prepare(`DELETE FROM user_sessions WHERE user_id = ?`);
    stmt.run([userId]);
    stmt.free();
    this.saveToDisk();
  }

  getUserByEmail(email: string): any | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(
      `SELECT id, email, name, password, role, email_verified, email_verification_token_hash, email_verification_expires, reset_token, reset_token_expires, created_at FROM users WHERE LOWER(email) = ?`
    );
    stmt.bind([email.toLowerCase().trim()]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return {
        id: row[0] as string,
        email: row[1] as string,
        name: row[2] as string,
        password: row[3] as string,
        role: row[4] as string,
        email_verified: row[5] !== undefined && row[5] !== null ? Number(row[5]) : 1,
        email_verification_token_hash: row[6] as string | null,
        email_verification_expires: row[7] as number | null,
        reset_token: row[8] as string | null,
        reset_token_expires: row[9] as number | null,
        created_at: row[10] as number,
      };
    }
    stmt.free();
    return null;
  }

  getUserById(id: string): any | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT id, email, name, password, role, email_verified, created_at FROM users WHERE id = ?`);
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return {
        id: row[0] as string,
        email: row[1] as string,
        name: row[2] as string,
        password: row[3] as string,
        role: row[4] as string,
        email_verified: row[5] !== undefined && row[5] !== null ? Number(row[5]) : 1,
        created_at: row[6] as number,
      };
    }
    stmt.free();
    return null;
  }

  getUserByVerificationTokenHash(tokenHash: string): any | null {
    if (!this.db || !tokenHash) return null;
    const stmt = this.db.prepare(
      `SELECT id, email, name, password, role, email_verified, email_verification_expires FROM users WHERE email_verification_token_hash = ?`
    );
    stmt.bind([tokenHash]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return {
        id: row[0] as string,
        email: row[1] as string,
        name: row[2] as string,
        password: row[3] as string,
        role: row[4] as string,
        email_verified: row[5] !== undefined && row[5] !== null ? Number(row[5]) : 0,
        email_verification_expires: row[6] as number | null,
      };
    }
    stmt.free();
    return null;
  }

  verifyUserEmail(userId: string): boolean {
    if (!this.db || !userId) return false;
    const stmt = this.db.prepare(
      `UPDATE users SET email_verified = 1, email_verification_token_hash = NULL, email_verification_expires = NULL WHERE id = ?`
    );
    stmt.run([userId]);
    stmt.free();
    this.saveToDisk();
    return true;
  }

  setVerificationToken(userId: string, tokenHash: string, expiresAt: number): boolean {
    if (!this.db || !userId) return false;
    const stmt = this.db.prepare(
      `UPDATE users SET email_verification_token_hash = ?, email_verification_expires = ? WHERE id = ?`
    );
    stmt.run([tokenHash, expiresAt, userId]);
    stmt.free();
    this.saveToDisk();
    return true;
  }

  setResetToken(email: string, token: string, expiresAt: number): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare(
      `UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE LOWER(email) = ?`
    );
    stmt.run([token, expiresAt, email.toLowerCase().trim()]);
    stmt.free();
    this.saveToDisk();
    return true;
  }

  getUserByResetToken(token: string): any | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(
      `SELECT id, email, name, password, role, reset_token_expires FROM users WHERE reset_token = ?`
    );
    stmt.bind([token]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return {
        id: row[0] as string,
        email: row[1] as string,
        name: row[2] as string,
        password: row[3] as string,
        role: row[4] as string,
        reset_token_expires: row[5] as number | null,
      };
    }
    stmt.free();
    return null;
  }

  updatePasswordAndClearResetToken(userId: string, newPassword: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?`
    );
    const hashedPassword = hashPassword(newPassword);
    stmt.run([hashedPassword, userId]);
    stmt.free();
    this.saveToDisk();
  }

  updateUserProfile(userId: string, name: string, role: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`UPDATE users SET name = ?, role = ? WHERE id = ?`);
    stmt.run([name, role, userId]);
    stmt.free();
    this.saveToDisk();
  }

  // --- Worker Ops ---
  saveWorker(worker: WorkerNodeData): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO workers (id, data, updated_at) VALUES (?, ?, ?)`
    );
    stmt.run([worker.id, JSON.stringify(worker), Date.now()]);
    stmt.free();
    this.saveToDisk();
  }

  getWorkers(): WorkerNodeData[] {
    if (!this.db) return [];
    const res = this.db.exec(`SELECT data FROM workers ORDER BY id ASC`);
    if (res.length === 0) return [];
    return res[0].values.map((row) => JSON.parse(row[0] as string));
  }

  getWorker(id: string): WorkerNodeData | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT data FROM workers WHERE id = ?`);
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return JSON.parse(row[0] as string);
    }
    stmt.free();
    return null;
  }

  // --- Job Ops ---
  saveJob(job: Job): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO jobs (id, status, data, updated_at) VALUES (?, ?, ?, ?)`
    );
    stmt.run([job.id, job.status, JSON.stringify(job), Date.now()]);
    stmt.free();
    this.saveToDisk();
  }

  getJobs(): Job[] {
    if (!this.db) return [];
    const res = this.db.exec(`SELECT data FROM jobs ORDER BY updated_at DESC`);
    if (res.length === 0) return [];
    return res[0].values.map((row) => JSON.parse(row[0] as string));
  }

  getJob(id: string): Job | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT data FROM jobs WHERE id = ?`);
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return JSON.parse(row[0] as string);
    }
    stmt.free();
    return null;
  }

  // --- Scheduler Decisions ---
  saveSchedulerDecision(decision: SchedulerDecision): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO scheduler_decisions (job_id, data, timestamp) VALUES (?, ?, ?)`
    );
    stmt.run([decision.jobId, JSON.stringify(decision), decision.timestamp]);
    stmt.free();
    this.saveToDisk();
  }

  getSchedulerDecisions(): SchedulerDecision[] {
    if (!this.db) return [];
    const res = this.db.exec(`SELECT data FROM scheduler_decisions ORDER BY timestamp DESC LIMIT 100`);
    if (res.length === 0) return [];
    return res[0].values.map((row) => JSON.parse(row[0] as string));
  }

  // --- Execution Ledger ---
  saveExecutionRecord(record: ExecutionRecord): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO execution_ledger (record_id, job_id, data, timestamp) VALUES (?, ?, ?, ?)`
    );
    stmt.run([record.recordId, record.jobId, JSON.stringify(record), record.timestamp]);
    stmt.free();
    this.saveToDisk();
  }

  getExecutionLedger(): ExecutionRecord[] {
    if (!this.db) return [];
    const res = this.db.exec(`SELECT data FROM execution_ledger ORDER BY timestamp DESC LIMIT 200`);
    if (res.length === 0) return [];
    return res[0].values.map((row) => JSON.parse(row[0] as string));
  }

  // --- Logs ---
  saveLog(log: SystemLog): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT INTO system_logs (id, level, data, timestamp) VALUES (?, ?, ?, ?)`
    );
    stmt.run([log.id, log.level, JSON.stringify(log), log.timestamp]);
    stmt.free();
    this.saveToDisk();
  }

  getLogs(limit = 200): SystemLog[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT data FROM system_logs ORDER BY timestamp DESC LIMIT ?`);
    stmt.bind([limit]);
    const logs: SystemLog[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      logs.push(JSON.parse(row[0] as string));
    }
    stmt.free();
    return logs;
  }

  // --- System Config ---
  saveConfig(key: string, value: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)`);
    stmt.run([key, value]);
    stmt.free();
    this.saveToDisk();
  }

  getConfig(key: string): string | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT value FROM system_config WHERE key = ?`);
    stmt.bind([key]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return row[0] as string;
    }
    stmt.free();
    return null;
  }
}

export const dbService = new DatabaseService();
