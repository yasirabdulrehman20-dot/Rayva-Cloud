import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { mainNode } from '../MainNode.js';
import { workerManager } from '../workers/WorkerManager.js';
import { WorkerNode } from '../workers/WorkerNode.js';
import { jobManager } from '../jobs/JobManager.js';
import { scheduler } from '../scheduler/Scheduler.js';
import { executionLedger } from '../ledger/ExecutionLedger.js';
import { logger } from '../monitoring/SystemLogger.js';
import { dbService, verifyPassword } from '../database/db.js';
import { getWorkerDisplayName, sanitizeWorkerText } from '../../shared/workerUtils.js';
import { createRateLimiter } from '../security/rateLimiter.js';
import { emailService } from '../email/emailService.js';
import { demoModeService } from '../security/demoMode.js';

export const apiRouter = Router();

// Rate limiters for authentication endpoints to prevent brute-force and abuse
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 60,
  message: 'Too many authentication attempts. Please try again in a few minutes.',
});

const signupLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 15,
  message: 'Too many account creation attempts. Please try again later.',
});

const demoActivationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20,
  message: 'Too many demo activation attempts. Please try again later.',
});

const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 15,
  message: 'Too many password reset attempts. Please try again later.',
});

const verificationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30,
  message: 'Too many email verification attempts. Please try again later.',
});

const resendVerificationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  message: 'Too many verification resend requests. Please try again later.',
});

// Robust RFC 5322 compatible email validation
function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

// Allowed roles for public signups (Administrator privileges can NEVER be self-assigned)
const ALLOWED_PUBLIC_ROLES = [
  'DevOps Engineer',
  'Site Reliability Engineer',
  'Cloud Architect',
  'Infrastructure Engineer',
];

export interface AuthenticatedRequest extends Request {
  user?: any;
  token?: string;
}

function logUserActivity(
  user: { id: string; email: string; role: string },
  action: string,
  message: string,
  resourceId?: string
): void {
  logger.info('UserActivity', message, {
    action,
    userId: user.id,
    userEmail: user.email,
    role: user.role,
    ...(resourceId ? { resourceId } : {}),
  });
}

// Auth Middleware to protect private / administrative endpoints
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const session = dbService.getSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  const user = dbService.getUserById(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'User account not found.' });
  }

  req.user = user;
  req.token = token;
  next();
};

// --- Auth Endpoints ---
apiRouter.post('/auth/signup', signupLimiter, async (req, res) => {
  const { name, email, password, role } = req.body;

  // 1. Email format and normalization
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  const normalizedEmail = (email as string).trim().toLowerCase();

  // 2. Name validation
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Full name must be between 2 and 100 characters.' });
  }
  const sanitizedName = name.trim();

  // 3. Password policy: minimum 12 characters, allow spaces and special characters, max 1024
  if (!password || typeof password !== 'string' || password.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters long.' });
  }
  if (password.length > 1024) {
    return res.status(400).json({ error: 'Password exceeds maximum length limit.' });
  }

  // 4. Duplicate account check
  const existing = dbService.getUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email address already exists.' });
  }

  // 5. Role isolation: public accounts can NEVER self-assign 'Cluster Admin'
  const userRole = (typeof role === 'string' && ALLOWED_PUBLIC_ROLES.includes(role))
    ? role
    : 'DevOps Engineer';

  const id = `usr-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

  const isConfigured = emailService.isConfigured();
  const isDemo = demoModeService.isDemoModeEnabled();
  // Auto-verify and activate on signup when live email service is not configured or in demo mode
  const autoVerifyOnSignup = !isConfigured || isDemo;

  // Generate cryptographically secure verification token & SHA-256 hash if required
  const rawVerificationToken = `vfy-${crypto.randomBytes(24).toString('hex')}`;
  const verificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
  const verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  try {
    dbService.createUser({
      id,
      email: normalizedEmail,
      name: sanitizedName,
      password,
      role: userRole,
      emailVerified: autoVerifyOnSignup ? 1 : 0,
      verificationTokenHash: autoVerifyOnSignup ? undefined : verificationTokenHash,
      verificationExpires: autoVerifyOnSignup ? undefined : verificationExpires,
    });
  } catch (err: any) {
    logger.error('Auth', `Failed to create user: ${err?.message || 'Database error'}`);
    return res.status(500).json({ error: 'Failed to create user account. Please try again.' });
  }

  if (autoVerifyOnSignup) {
    logger.info('Auth', `User registered successfully - ${normalizedEmail}`, {
      action: 'USER_REGISTERED',
      userId: id,
      userEmail: normalizedEmail,
      role: userRole,
    });
    const sessionToken = `rayva_token_${id}_${crypto.randomBytes(24).toString('hex')}`;
    dbService.createSession(id, sessionToken);

    const user = {
      id,
      email: normalizedEmail,
      name: sanitizedName,
      role: userRole,
      emailVerified: true,
      createdAt: Date.now(),
    };

    return res.status(201).json({
      status: 'ok',
      message: 'Account created successfully.',
      user,
      token: sessionToken,
      unverified: false,
    });
  }

  logger.info('Auth', `User registered successfully - ${normalizedEmail}`, {
    action: 'USER_REGISTERED',
    userId: id,
    userEmail: normalizedEmail,
    role: userRole,
    emailVerified: false,
  });

  // Dispatch verification email if provider configured
  await emailService.sendVerificationEmail(normalizedEmail, sanitizedName, rawVerificationToken);

  const user = {
    id,
    email: normalizedEmail,
    name: sanitizedName,
    role: userRole,
    emailVerified: false,
    createdAt: Date.now(),
  };

  res.status(201).json({
    status: 'ok',
    message: 'Account created successfully. A verification link has been dispatched to your email address.',
    user,
    unverified: true,
    emailDeliveryConfigured: true,
  });
});

apiRouter.post('/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const dbUser = dbService.getUserByEmail(normalizedEmail);

  // Anti-enumeration: consistent 401 response for missing user or wrong password
  if (!dbUser || !verifyPassword(password, dbUser.password)) {
    logger.warn('Auth', `Login failed - ${normalizedEmail}`, {
      action: 'USER_LOGIN_FAILED',
      userEmail: normalizedEmail,
      reason: 'INVALID_CREDENTIALS',
    });
    return res.status(401).json({ error: 'Invalid email address or password.' });
  }

  // Check email verification status
  if (dbUser.email_verified === 0) {
    logger.info('Auth', `Login rejected - unverified email ${normalizedEmail}`, {
      action: 'USER_LOGIN_REJECTED_UNVERIFIED',
      userId: dbUser.id,
      userEmail: dbUser.email,
      role: dbUser.role,
    });
    const isConfigured = emailService.isConfigured();
    const isDemo = demoModeService.isDemoModeEnabled();
    const demoActivationTicket = isDemo && !isConfigured && dbUser.role !== 'Cluster Admin' && dbUser.email !== 'admin@rayva.io'
      ? demoModeService.issueActivationTicket(dbUser.id, dbUser.email)
      : undefined;

    return res.status(403).json({
      error: isConfigured
        ? 'Your email address has not been verified yet. Please check your inbox or request a new verification link.'
        : isDemo
          ? 'Your email address has not been verified yet. Click "Activate Demo Account" to activate immediately.'
          : 'Your email address has not been verified yet. Please enter your verification token to activate your account.',
      unverified: true,
      email: dbUser.email,
      emailDeliveryConfigured: isConfigured,
      demoMode: isDemo,
      demoActivationTicket,
    });
  }

  const token = `rayva_token_${dbUser.id}_${crypto.randomBytes(24).toString('hex')}`;
  dbService.createSession(dbUser.id, token);
  logger.info('Auth', `User login successful - ${dbUser.email}`, {
    action: 'USER_LOGIN_SUCCESS',
    userId: dbUser.id,
    userEmail: dbUser.email,
    role: dbUser.role,
  });

  const user = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    emailVerified: true,
    createdAt: dbUser.created_at || Date.now(),
  };

  res.json({ status: 'ok', user, token });
});

apiRouter.post('/auth/demo-activate', demoActivationLimiter, (req, res) => {
  // 1. Check if demo mode is enabled
  if (!demoModeService.isDemoModeEnabled()) {
    return res.status(403).json({ error: 'Demo activation is not enabled on this instance.' });
  }

  const { ticket, email } = req.body;

  if (!ticket || typeof ticket !== 'string' || !ticket.trim()) {
    return res.status(400).json({ error: 'Demo activation ticket is required.' });
  }

  // 2. Validate and consume ticket (single-use guarantee with 10m TTL)
  const record = demoModeService.consumeActivationTicket(ticket.trim());
  if (!record) {
    return res.status(400).json({ error: 'Invalid, expired, or previously consumed demo activation ticket.' });
  }

  // Double check email match if provided
  if (email && typeof email === 'string' && email.trim().toLowerCase() !== record.email) {
    return res.status(400).json({ error: 'Activation ticket does not match the target email.' });
  }

  // 3. Strict security guard: Never allow Cluster Admin activation via demo endpoint
  const targetUser = dbService.getUserByEmail(record.email);
  if (!targetUser) {
    return res.status(400).json({ error: 'Account not found.' });
  }

  if (targetUser.role === 'Cluster Admin' || targetUser.email === 'admin@rayva.io' || targetUser.id === 'usr-admin-default') {
    logger.warn('Security', `Attempted unauthorized demo activation on Cluster Admin account blocked.`);
    return res.status(403).json({ error: 'Cluster Admin accounts cannot be activated via demo endpoint.' });
  }

  // 4. Mark only target public account as verified and clear verification tokens
  dbService.verifyUserEmail(targetUser.id);
  logger.info('Auth', `Public demo account verified via demo activation: ${targetUser.email} (${targetUser.role})`);

  res.json({
    status: 'ok',
    message: 'Demo account activated successfully. You can now sign in.',
    email: targetUser.email,
  });
});

apiRouter.post('/auth/verify-email', verificationLimiter, async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  const sanitizedToken = token.trim();
  const tokenHash = crypto.createHash('sha256').update(sanitizedToken).digest('hex');

  const dbUser = dbService.getUserByVerificationTokenHash(tokenHash);
  if (!dbUser) {
    return res.status(400).json({ error: 'Invalid or expired verification token. Please request a new verification email.' });
  }

  if (dbUser.email_verification_expires && Date.now() > dbUser.email_verification_expires) {
    return res.status(400).json({ error: 'This verification token has expired. Please request a new verification email.' });
  }

  if (dbUser.email_verified === 1) {
    return res.status(400).json({ error: 'This account has already been verified. You can log in.' });
  }

  // Mark user as verified and invalidate token
  dbService.verifyUserEmail(dbUser.id);
  logger.info('Auth', `Email verification completed successfully for user account.`);

  res.json({
    status: 'ok',
    message: 'Email address successfully verified. You can now log in to Rayva Cloud.',
    email: dbUser.email,
  });
});

apiRouter.post('/auth/resend-verification', resendVerificationLimiter, async (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const normalizedEmail = (email as string).trim().toLowerCase();
  const dbUser = dbService.getUserByEmail(normalizedEmail);
  let devToken: string | undefined = undefined;

  if (dbUser && dbUser.email_verified === 0) {
    const rawVerificationToken = `vfy-${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    dbService.setVerificationToken(dbUser.id, tokenHash, expiresAt);
    await emailService.sendVerificationEmail(dbUser.email, dbUser.name, rawVerificationToken);
    logger.info('Auth', `New email verification token generated.`);

    if (process.env.NODE_ENV !== 'production' && !emailService.isConfigured()) {
      devToken = rawVerificationToken;
    }
  }

  const isConfigured = emailService.isConfigured();

  // Generic anti-enumeration response
  res.json({
    status: 'ok',
    message: isConfigured
      ? 'If an account exists and requires verification, a verification link has been dispatched to your email.'
      : 'If an account exists and requires verification, a new token has been generated. (Live email delivery is unconfigured).',
    emailDeliveryConfigured: isConfigured,
    devVerificationToken: devToken,
  });
});

apiRouter.get('/auth/email-service-status', (req, res) => {
  const status = emailService.getStatus();
  const demoMode = demoModeService.isDemoModeEnabled();
  res.json({
    status: 'ok',
    data: {
      configured: status.configured,
      provider: status.provider,
      fromAddress: status.fromAddress,
      demoMode,
    },
  });
});

apiRouter.post('/auth/forgot-password', passwordResetLimiter, (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const normalizedEmail = (email as string).trim().toLowerCase();
  const dbUser = dbService.getUserByEmail(normalizedEmail);

  if (dbUser) {
    const resetToken = `rst-${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour expiration
    dbService.setResetToken(normalizedEmail, resetToken, expiresAt);
    logger.info('Auth', `Password reset token generated for account.`);
  }

  // Anti-enumeration: return a consistent response regardless of whether the email was found
  res.json({
    status: 'ok',
    message: 'If an account is associated with this email address, password reset instructions have been generated.',
  });
});

apiRouter.post('/auth/reset-password', passwordResetLimiter, (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'Password reset token is required.' });
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 12) {
    return res.status(400).json({ error: 'New password must be at least 12 characters long.' });
  }
  if (newPassword.length > 1024) {
    return res.status(400).json({ error: 'Password exceeds maximum length limit.' });
  }

  const sanitizedToken = token.trim();
  const dbUser = dbService.getUserByResetToken(sanitizedToken);
  if (!dbUser) {
    return res.status(400).json({ error: 'Invalid or expired password reset token.' });
  }

  if (dbUser.reset_token_expires && Date.now() > dbUser.reset_token_expires) {
    return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
  }

  dbService.updatePasswordAndClearResetToken(dbUser.id, newPassword);
  // Clear all active sessions so user must log in again with the new credentials
  dbService.deleteUserSessions(dbUser.id);
  logger.info('Auth', `Password reset successfully for user ID ${dbUser.id}`);

  res.json({ status: 'ok', message: 'Password has been updated successfully. You can now log in.' });
});

apiRouter.get('/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const session = dbService.getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  const dbUser = dbService.getUserById(session.user_id);
  if (!dbUser) {
    return res.status(401).json({ error: 'User session invalid or expired' });
  }

  res.json({
    status: 'ok',
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      createdAt: dbUser.created_at,
    },
  });
});

apiRouter.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const session = dbService.getSession(token);
    const sessionUser = session ? dbService.getUserById(session.user_id) : null;
    if (sessionUser) {
      logUserActivity(
        { id: sessionUser.id, email: sessionUser.email, role: sessionUser.role },
        'USER_LOGOUT',
        `User logout - ${sessionUser.email}`
      );
    }
    dbService.deleteSession(token);
  }
  res.json({ status: 'ok', message: 'Logged out successfully' });
});

apiRouter.put('/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;
  const { name, role } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
  }

  // Privilege escalation check: only a Cluster Admin can assign the Cluster Admin role
  let targetRole = typeof role === 'string' ? role : req.user.role;
  if (targetRole === 'Cluster Admin' && req.user.role !== 'Cluster Admin') {
    return res.status(403).json({ error: 'Only a Cluster Admin can assign administrator privileges.' });
  }

  // If role is invalid or not in allowed roles, retain current role
  if (targetRole !== 'Cluster Admin' && !ALLOWED_PUBLIC_ROLES.includes(targetRole)) {
    targetRole = req.user.role;
  }

  dbService.updateUserProfile(userId, name.trim(), targetRole);
  const updatedUser = dbService.getUserById(userId);

  res.json({
    status: 'ok',
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      createdAt: updatedUser.created_at,
    },
  });
});

// --- Workers ---
apiRouter.get('/workers', (req, res) => {
  const workers = workerManager.getAllWorkers();
  res.json({ status: 'ok', data: workers });
});

apiRouter.get('/workers/:id', (req, res) => {
  const worker = workerManager.getWorkerData(req.params.id);
  if (!worker) {
    return res.status(404).json({ error: 'Worker node not found' });
  }
  res.json({ status: 'ok', data: worker });
});

apiRouter.post('/workers', requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, host, cpuCapacity, ramCapacity } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Worker name is required' });
  }
  const id = `worker-${Date.now().toString(36)}`;
  const node = new WorkerNode(id, name, host, cpuCapacity || 4, ramCapacity || 16384);
  workerManager.registerWorker(node);
  logUserActivity(req.user, 'WORKER_REGISTERED', `Worker registered - ${node.data.name}`, node.data.id);
  res.status(201).json({ status: 'ok', data: node.data });
});

apiRouter.post('/workers/:id/fail', requireAuth, (req: AuthenticatedRequest, res) => {
  const success = workerManager.simulateWorkerFailure(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Worker node not found' });
  }
  logUserActivity(req.user, 'WORKER_FAILURE_SIMULATED', `Worker failure simulated - ${req.params.id}`, req.params.id);
  mainNode.emit('update');
  res.json({ status: 'ok', message: `Simulated node failure on worker ${req.params.id}` });
});

apiRouter.post('/workers/:id/recover', requireAuth, (req: AuthenticatedRequest, res) => {
  const success = workerManager.recoverWorker(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Worker node not found' });
  }
  logUserActivity(req.user, 'WORKER_RECOVERED', `Worker recovered - ${req.params.id}`, req.params.id);
  void mainNode.processQueuedJobs();
  mainNode.emit('update');
  res.json({ status: 'ok', message: `Recovered worker node ${req.params.id}` });
});

// --- Jobs ---
apiRouter.get('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = req.user.role === 'Cluster Admin';
  const jobs = isAdmin ? jobManager.getAllJobs() : jobManager.getJobsForUser(req.user.id);
  res.json({ status: 'ok', data: jobs });
});

apiRouter.get('/jobs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = req.user.role === 'Cluster Admin';
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (!isAdmin && job.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied. You do not have permission to view this job.' });
  }
  res.json({ status: 'ok', data: job });
});

apiRouter.post('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (mainNode.isMaintenanceMode()) {
    return res.status(503).json({ error: 'System is currently under maintenance. Job submissions are disabled.' });
  }
  const { name, type, priority, payload } = req.body;
  if (!type) {
    return res.status(400).json({ error: 'Job type is required' });
  }
  try {
    const userId = req.user.id;
    const submittedBy = req.user.name || req.user.email || 'User';
    const job = mainNode.submitJob(name, type, priority, payload, userId, submittedBy);
    logUserActivity(req.user, 'JOB_SUBMITTED', `Job submitted - ${job.id} - ${req.user.email}`, job.id);
    res.status(201).json({ status: 'ok', data: job });
  } catch (err: any) {
    res.status(503).json({ error: err.message || 'Job submission rejected' });
  }
});

apiRouter.delete('/jobs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = req.user.role === 'Cluster Admin';
  const existingJob = jobManager.getJob(req.params.id);
  if (!existingJob) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (!isAdmin && existingJob.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied. You do not have permission to cancel this job.' });
  }

  const success = jobManager.cancelJobForUser(req.params.id, req.user.id, isAdmin);
  if (!success) {
    return res.status(400).json({ error: 'Job cannot be cancelled or was not found' });
  }
  logUserActivity(req.user, 'JOB_CANCELLED', `Job cancelled - ${req.params.id} - ${req.user.email}`, req.params.id);
  mainNode.emit('update');
  res.json({ status: 'ok', message: `Cancelled job ${req.params.id}` });
});

apiRouter.post('/jobs/:id/cancel', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = req.user.role === 'Cluster Admin';
  const existingJob = jobManager.getJob(req.params.id);
  if (!existingJob) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (!isAdmin && existingJob.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied. You do not have permission to cancel this job.' });
  }

  const success = jobManager.cancelJobForUser(req.params.id, req.user.id, isAdmin);
  if (!success) {
    return res.status(400).json({ error: 'Job cannot be cancelled or was not found' });
  }
  logUserActivity(req.user, 'JOB_CANCELLED', `Job cancelled - ${req.params.id} - ${req.user.email}`, req.params.id);
  mainNode.emit('update');
  res.json({ status: 'ok', message: `Cancelled job ${req.params.id}` });
});

// --- Scheduler ---
apiRouter.get('/scheduler/decisions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    return res.status(403).json({ error: 'Only Cluster Admin users can view scheduler audit decisions.' });
  }
  const decisions = scheduler.getRecentDecisions().map((d) => ({
    ...d,
    selectedWorkerName: getWorkerDisplayName(d.selectedWorkerId, d.selectedWorkerName),
    reason: sanitizeWorkerText(d.reason),
  }));
  res.json({ status: 'ok', data: decisions });
});

apiRouter.get('/scheduler/strategies', (req, res) => {
  const strategies = scheduler.getAvailableStrategies();
  const active = scheduler.getActiveStrategyType();
  res.json({ status: 'ok', active, data: strategies });
});

apiRouter.post('/scheduler/strategy', requireAuth, (req: AuthenticatedRequest, res) => {
  const { strategy } = req.body;
  const success = scheduler.setStrategy(strategy);
  if (!success) {
    return res.status(400).json({ error: `Invalid scheduling strategy: ${strategy}` });
  }
  logUserActivity(req.user, 'SCHEDULER_STRATEGY_CHANGED', `Scheduler strategy changed - ${strategy}`, strategy);
  mainNode.emit('update');
  res.json({ status: 'ok', message: `Active strategy changed to ${strategy}` });
});

// --- Ledger ---
apiRouter.get('/ledger', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = req.user.role === 'Cluster Admin';
  const records = executionLedger.getRecords();
  const visibleRecords = isAdmin
    ? records
    : records.filter((record) => {
        const job = jobManager.getJobForUser(record.jobId, req.user.id, false);
        return Boolean(job);
      });
  res.json({ status: 'ok', data: visibleRecords });
});

apiRouter.get('/ledger/verify', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user.role !== 'Cluster Admin') {
    return res.status(403).json({ error: 'Only Cluster Admin users can verify the execution ledger.' });
  }
  const verification = executionLedger.verifyChainIntegrity();
  res.json({ status: 'ok', data: verification });
});

// --- Logs & Analytics & System ---
apiRouter.get('/logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const level = req.query.level as any;
  const search = req.query.search as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
  const logs = logger.getLogs(limit, level, search);
  const visibleLogs = req.user.role === 'Cluster Admin'
    ? logs
    : logs.filter((log) => {
        if (log.component.toLowerCase() === 'auth') return false;
        const metadata = log.metadata || {};
        return metadata.userId === req.user.id || metadata.ownerId === req.user.id || metadata.createdBy === req.user.id ||
          metadata.userEmail === req.user.email || metadata.email === req.user.email;
      });
  res.json({ status: 'ok', data: visibleLogs });
});

apiRouter.get('/system/status', (req, res) => {
  const status = mainNode.getSystemStatus();
  res.json({ status: 'ok', data: status });
});

apiRouter.post('/system/maintenance', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Property "enabled" must be a boolean.' });
  }
  mainNode.setMaintenanceMode(enabled);
  logUserActivity(req.user, 'MAINTENANCE_MODE_CHANGED', `Maintenance mode ${enabled ? 'enabled' : 'disabled'} - ${req.user.email}`);
  res.json({
    status: 'ok',
    maintenanceMode: enabled,
    message: `System maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'}`,
  });
});

apiRouter.post('/system/stress-load', requireAuth, (req: AuthenticatedRequest, res) => {
  if (mainNode.isMaintenanceMode()) {
    return res.status(503).json({ error: 'Cannot trigger stress load while system is in maintenance mode.' });
  }
  const workers = workerManager.getAllWorkers();
  // Submit 6 heavy CPU/RAM intensive jobs concurrently to trigger > 90% load
  for (let i = 0; i < 6; i++) {
    mainNode.submitJob(
      `High-Load Stress Test Job #${i + 1}`,
      i % 2 === 0 ? 'MATRIX_OPS' : 'AI_INFERENCE',
      'CRITICAL',
      { matrixSize: 200, iterations: 100000, complexity: 10 }
    );
  }
  logger.warn('System', '[RESOURCE OVERLOAD SIMULATION] High-load stress workload injected into cluster.');
  logUserActivity(req.user, 'STRESS_LOAD_STARTED', `Stress load started - ${req.user.email}`);
  mainNode.emit('update');
  res.json({ status: 'ok', message: 'Triggered cluster stress load (>90% target)' });
});

apiRouter.post('/system/clear-stress', requireAuth, (req: AuthenticatedRequest, res) => {
  const jobs = jobManager.getAllJobs();
  jobs.forEach((j) => {
    if (j.status === 'RUNNING' || j.status === 'QUEUED' || j.status === 'ASSIGNED') {
      jobManager.cancelJob(j.id);
    }
  });
  logger.info('System', '[RESOURCE LOAD RELIEF] Cleared active high-load jobs from queue.');
  logUserActivity(req.user, 'STRESS_LOAD_CLEARED', `Stress load cleared - ${req.user.email}`);
  mainNode.emit('update');
  res.json({ status: 'ok', message: 'Cleared active workload and relieved system load.' });
});

let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

apiRouter.post('/system/health-report', async (req, res) => {
  const status = mainNode.getSystemStatus();
  const workers = workerManager.getAllWorkers();
  const jobs = jobManager.getAllJobs();

  const totalJobs = jobs.length;
  const completed = jobs.filter((j) => j.status === 'COMPLETED').length;
  const failed = jobs.filter((j) => j.status === 'FAILED').length;
  const queued = jobs.filter((j) => j.status === 'QUEUED').length;
  const running = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'ASSIGNED').length;
  const onlineWorkers = workers.filter((w) => w.status !== 'OFFLINE' && w.status !== 'FAILED').length;
  const totalWorkers = workers.length;

  const cpu = status.systemCpuUsage || 0;
  const ram = status.systemRamUsage || 0;
  const isMaintenance = status.maintenanceMode;

  let grade: 'OPTIMAL' | 'ELEVATED LOAD' | 'CRITICAL LOAD' | 'MAINTENANCE' = 'OPTIMAL';
  let score = 98;

  if (isMaintenance) {
    grade = 'MAINTENANCE';
    score = 80;
  } else if (cpu >= 90 || ram >= 90) {
    grade = 'CRITICAL LOAD';
    score = Math.max(35, 100 - Math.max(cpu, ram));
  } else if (cpu >= 70 || ram >= 70 || queued > 5) {
    grade = 'ELEVATED LOAD';
    score = Math.max(65, 100 - Math.round((cpu + ram) / 2));
  } else {
    score = Math.max(88, 100 - Math.round((cpu + ram) / 4) - failed * 2);
  }

  let executiveSummary = '';
  let keyObservations: string[] = [];
  let recommendations: string[] = [];
  let generatedBy = 'Rayva Cluster Health Engine';

  const ai = getAiClient();
  if (ai) {
    try {
      const prompt = `You are the lead Cloud Infrastructure Engineer for Rayva Cloud, a high-performance distributed job scheduling platform.
Analyze the following real-time cluster telemetry and produce a concise, professional executive health summary:

Metrics:
- Workers Online: ${onlineWorkers} / ${totalWorkers}
- CPU Usage: ${cpu}%
- RAM Usage: ${ram}%
- Active Jobs: ${running}
- Queued Jobs: ${queued}
- Completed Jobs: ${completed}
- Failed Jobs: ${failed}
- Active Scheduling Strategy: ${status.activeStrategy}
- System Maintenance Mode: ${isMaintenance ? 'ENABLED' : 'DISABLED'}
- System Uptime: ${status.uptimeSeconds} seconds

Format your response as valid JSON with the following structure:
{
  "executiveSummary": "2-3 concise sentences summarizing cluster health, resource load, and scheduler posture.",
  "keyObservations": ["bullet point 1", "bullet point 2", "bullet point 3"],
  "recommendations": ["actionable rec 1", "actionable rec 2"]
}
`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (aiResponse.text) {
        const parsed = JSON.parse(aiResponse.text);
        executiveSummary = parsed.executiveSummary || '';
        keyObservations = parsed.keyObservations || [];
        recommendations = parsed.recommendations || [];
        generatedBy = 'Gemini 3.6 Flash AI Engine';
      }
    } catch (err) {
      logger.error('HealthReport', 'Failed to generate AI executive summary, falling back to algorithmic analyzer');
    }
  }

  // Fallback if AI was not used or failed
  if (!executiveSummary) {
    const summaryParts: string[] = [
      `The Rayva Cloud cluster is running with ${onlineWorkers}/${totalWorkers} active nodes (${Math.round(
        (onlineWorkers / Math.max(1, totalWorkers)) * 100
      )}% node availability).`,
      `Cluster compute utilization stands at ${cpu}% CPU and ${ram}% RAM.`,
    ];

    if (isMaintenance) {
      summaryParts.push(
        'System Maintenance Mode is currently active, suspending new submissions while running workloads complete.'
      );
    } else if (grade === 'CRITICAL LOAD') {
      summaryParts.push('ALERT: Cluster is experiencing heavy load (>90% utilization). Queue latency may increase.');
    } else {
      summaryParts.push('Cluster metrics are within optimal operational boundaries with available headroom.');
    }

    executiveSummary = summaryParts.join(' ');
  }

  if (!keyObservations || keyObservations.length === 0) {
    keyObservations = [
      `Node Posture: ${onlineWorkers}/${totalWorkers} workers online with average CPU at ${cpu}%.`,
      `Pipeline Load: ${running} jobs active, ${queued} queued, ${completed} completed, ${failed} failed.`,
      `Scheduler Policy: Active strategy '${status.activeStrategy}' handling job placement.`,
    ];
  }

  if (!recommendations || recommendations.length === 0) {
    if (isMaintenance) {
      recommendations.push('Disable maintenance mode to re-enable job submissions once system servicing is finished.');
    }
    if (cpu >= 85 || ram >= 85) {
      recommendations.push('Register or scale additional worker nodes to relieve core resource saturation.');
    }
    if (queued > 5) {
      recommendations.push('Switch scheduler to Least Loaded or Resource Aware policy for faster queue dissipation.');
    }
    if (recommendations.length === 0) {
      recommendations.push('All parameters operating within target capacity. Continue regular monitoring.');
    }
  }

  res.json({
    status: 'ok',
    report: {
      timestamp: Date.now(),
      healthGrade: grade,
      healthScore: score,
      generatedBy,
      executiveSummary,
      keyObservations,
      metrics: {
        workersOnline: onlineWorkers,
        workersTotal: totalWorkers,
        activeJobs: running,
        queuedJobs: queued,
        completedJobs: completed,
        failedJobs: failed,
        cpuUsage: cpu,
        ramUsage: ram,
        activeStrategy: status.activeStrategy,
        maintenanceMode: isMaintenance,
      },
      recommendations,
    },
  });
});

apiRouter.get('/analytics', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const workers = workerManager.getAllWorkers();
  const isAdmin = req.user.role === 'Cluster Admin';
  const jobs = isAdmin ? jobManager.getAllJobs() : jobManager.getJobsForUser(req.user.id);
  const decisions = scheduler.getRecentDecisions();
  const status = mainNode.getSystemStatus();

  res.json({
    status: 'ok',
    data: {
      status,
      workers,
      jobsSummary: {
        total: jobs.length,
        completed: jobs.filter((j) => j.status === 'COMPLETED').length,
        failed: jobs.filter((j) => j.status === 'FAILED').length,
        queued: jobs.filter((j) => j.status === 'QUEUED' || j.status === 'RETRYING').length,
        running: jobs.filter((j) => j.status === 'RUNNING' || j.status === 'ASSIGNED' || j.status === 'SCHEDULING').length,
      },
      decisionsCount: decisions.length,
    },
  });
});

// --- Simulation ---
apiRouter.post('/simulation/start', requireAuth, (req: AuthenticatedRequest, res) => {
  mainNode.startSimulation(req.body);
  logUserActivity(req.user, 'SIMULATION_STARTED', `Simulation started - ${req.user.email}`);
  res.json({ status: 'ok', message: 'Simulation engine started' });
});

apiRouter.post('/simulation/pause', requireAuth, (req: AuthenticatedRequest, res) => {
  mainNode.pauseSimulation();
  logUserActivity(req.user, 'SIMULATION_PAUSED', `Simulation paused - ${req.user.email}`);
  res.json({ status: 'ok', message: 'Simulation engine paused' });
});

// --- CLI Runner Endpoint ---
// --- Database Diagnostic & Recovery Endpoints ---
apiRouter.get('/system/database/status', (req, res) => {
  try {
    const status = dbService.getDatabaseStatus();
    res.json({ status: 'ok', data: status });
  } catch (err: any) {
    logger.error('Database', `Error fetching database status: ${err.message}`);
    res.status(500).json({ error: 'Failed to retrieve database status', details: err.message });
  }
});

apiRouter.post('/system/database/check', (req, res) => {
  try {
    const checkResult = dbService.checkIntegrity();
    logger.info('Database', `Manual integrity check performed. Result: ${checkResult.status}`);
    res.json({ status: 'ok', data: checkResult });
  } catch (err: any) {
    logger.error('Database', `Error performing database integrity check: ${err.message}`);
    res.status(500).json({ error: 'Integrity check execution failed', details: err.message });
  }
});

apiRouter.post('/system/database/recover', async (req, res) => {
  try {
    logger.warn('Database', 'Manual Database Recovery initiated by user/administrator');
    const result = await dbService.recoverAndReinitialize();

    // Reset and re-initialize in-memory managers
    await workerManager.resetAndReinit();
    await jobManager.resetAndReinit();

    logger.info('Database', `Database Recovery successful. Backup saved to: ${result.backupPath || 'backups/'}`);

    res.json({
      status: 'ok',
      message: result.message,
      data: result,
    });
  } catch (err: any) {
    logger.error('Database', `Database Recovery failed: ${err.message}`);
    res.status(500).json({ error: 'Database recovery procedure failed', details: err.message });
  }
});

apiRouter.post('/cli/exec', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Command string is required' });
  }

  const parts = command.trim().split(/\s+/);
  const rootCmd = parts[0]?.toLowerCase();
  if (rootCmd !== 'rayva' && rootCmd !== 'minicloud') {
    return res.json({ output: `Error: Unknown command. Commands must start with 'rayva'. Type 'rayva help' for options.` });
  }

  const sub = parts[1];
  const action = parts[2];

  let output = '';
  const isAdmin = req.user.role === 'Cluster Admin';

  try {
    if (sub === 'worker') {
      if (action === 'list') {
        const workers = workerManager.getAllWorkers();
        output = `ID          NAME                              STATUS   CPU%   RAM%   SCORE  ACTIVE\n`;
        output += `-----------------------------------------------------------------------------\n`;
        workers.forEach((w) => {
          output += `${w.id.padEnd(11)} ${w.name.substring(0, 32).padEnd(33)} ${w.status.padEnd(8)} ${(w.currentCpuUsage + '%').padEnd(6)} ${(w.currentRamUsage + '%').padEnd(6)} ${(w.score + '').padEnd(6)} ${w.activeJobs}\n`;
        });
      } else if (action === 'status' && parts[3]) {
        const w = workerManager.getWorkerData(parts[3]);
        if (!w) {
          output = `Error: Worker '${parts[3]}' not found.`;
        } else {
          output = JSON.stringify(w, null, 2);
        }
      } else if (action === 'register') {
        if (!isAdmin) {
          output = `Error: Only Cluster Admin can register workers via CLI.`;
        } else {
          const name = parts[3] || 'Worker-CLI';
          const id = `worker-cli-${Date.now().toString(36)}`;
          const node = new WorkerNode(id, name, '10.0.1.99', 4, 16384);
          workerManager.registerWorker(node);
          output = `Successfully registered worker: ${name} (${id})`;
        }
      } else {
        output = `Usage: rayva worker [list|status <id>|register <name>]`;
      }
    } else if (sub === 'job') {
      if (action === 'submit') {
        if (mainNode.isMaintenanceMode()) {
          output = `Error: System is currently under maintenance. Job submissions are disabled.`;
        } else {
          const typeIndex = parts.indexOf('--type');
          const nameIndex = parts.indexOf('--name');
          const prioIndex = parts.indexOf('--priority');

          const type = typeIndex !== -1 ? parts[typeIndex + 1] : 'PRIME_CALC';
          const name = nameIndex !== -1 ? parts[nameIndex + 1] : 'CLI Job';
          const priority = prioIndex !== -1 ? parts[prioIndex + 1] : 'NORMAL';

          const job = mainNode.submitJob(name, type as any, priority as any, { targetNumber: 30000 }, req.user.id, req.user.name || req.user.email);
          output = `Job submitted successfully!\nJob ID: ${job.id}\nStatus: ${job.status}\nPriority: ${job.priority}`;
        }
      } else if (action === 'list') {
        const userJobs = isAdmin ? jobManager.getAllJobs() : jobManager.getJobsForUser(req.user.id);
        const displayJobs = userJobs.slice(0, 15);
        output = `JOB ID          NAME                 TYPE         PRIORITY STATUS     WORKER\n`;
        output += `-----------------------------------------------------------------------------\n`;
        displayJobs.forEach((j) => {
          output += `${j.id.padEnd(15)} ${j.name.substring(0, 20).padEnd(20)} ${j.type.padEnd(12)} ${j.priority.padEnd(8)} ${j.status.padEnd(10)} ${j.assignedWorkerId || 'Unassigned'}\n`;
        });
      } else if (action === 'status' && parts[3]) {
        const j = jobManager.getJob(parts[3]);
        if (!j || (!isAdmin && j.userId !== req.user.id)) {
          output = `Error: Job '${parts[3]}' not found or permission denied.`;
        } else {
          output = JSON.stringify(j, null, 2);
        }
      } else if (action === 'cancel' && parts[3]) {
        const ok = jobManager.cancelJobForUser(parts[3], req.user.id, isAdmin);
        output = ok ? `Successfully cancelled job ${parts[3]}` : `Failed to cancel job ${parts[3]} (or access denied)`;
      } else {
        output = `Usage: rayva job [submit --type <TYPE> --name <NAME> --priority <PRIO>|list|status <id>|cancel <id>]`;
      }
    } else if (sub === 'scheduler') {
      if (action === 'status') {
        const active = scheduler.getActiveStrategyType();
        const strats = scheduler.getAvailableStrategies();
        output = `Active Scheduling Strategy: ${active}\nAvailable Strategies:\n`;
        strats.forEach((s) => {
          output += ` - ${s.type.padEnd(16)}: ${s.name}\n`;
        });
      } else {
        output = `Usage: rayva scheduler status`;
      }
    } else if (sub === 'system') {
      if (action === 'status') {
        const status = mainNode.getSystemStatus();
        output = `RAYVA CLOUD SYSTEM STATUS\n=======================\n`;
        output += `Workers Total: ${status.totalWorkers} (Online: ${status.onlineWorkers}, Busy: ${status.busyWorkers}, Failed: ${status.failedWorkers})\n`;
        output += `Jobs Total:    ${status.totalJobs} (Active: ${status.activeJobs}, Queued: ${status.queuedJobs}, Completed: ${status.completedJobs}, Failed: ${status.failedJobs})\n`;
        output += `Cluster CPU:   ${status.systemCpuUsage}%\n`;
        output += `Cluster RAM:   ${status.systemRamUsage}%\n`;
        output += `Active Strategy: ${status.activeStrategy}\n`;
        output += `Uptime:        ${status.uptimeSeconds}s\n`;
      } else {
        output = `Usage: rayva system status`;
      }
    } else if (sub === 'about') {
      output = `RAYVA CLOUD PLATFORM\n`;
      output += `=====================\n`;
      output += `Developed by Abdul Rehman Yasir\n\n`;
      output += `Rayva Cloud is a high-performance distributed job scheduler & cloud infrastructure control plane.`;
    } else if (sub === 'help' || !sub) {
      output = `Rayva Cloud Distributed Job Scheduler CLI\n`;
      output += `Available commands:\n`;
      output += `  rayva worker list\n`;
      output += `  rayva worker status <id>\n`;
      output += `  rayva worker register <name>\n`;
      output += `  rayva job submit --type <TYPE> --name <NAME> --priority <PRIO>\n`;
      output += `  rayva job list\n`;
      output += `  rayva job status <id>\n`;
      output += `  rayva job cancel <id>\n`;
      output += `  rayva scheduler status\n`;
      output += `  rayva system status\n`;
      output += `  rayva about\n`;
    } else {
      output = `Error: Unknown sub-command '${sub}'. Type 'rayva help' for usage.`;
    }
  } catch (e: any) {
    output = `CLI Error: ${e.message}`;
  }

  res.json({ output });
});
