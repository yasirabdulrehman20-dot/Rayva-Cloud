import crypto from 'crypto';
import http from 'http';
import express from 'express';
import { apiRouter } from '../src/backend/api/router.js';
import { dbService } from '../src/backend/database/db.js';
import { emailService } from '../src/backend/email/emailService.js';
import { logger } from '../src/backend/monitoring/SystemLogger.js';

async function runTestSuite() {
  console.log('====================================================');
  console.log('RAYVA CLOUD PRODUCTION AUTHENTICATION TEST SUITE');
  console.log('====================================================\n');

  // Enforce production mode environment
  process.env.NODE_ENV = 'production';
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.EMAIL_PROVIDER;
  emailService.reloadConfig();

  console.log(`[TEST SETUP] NODE_ENV = ${process.env.NODE_ENV}`);
  console.log(`[TEST SETUP] emailService.isConfigured() = ${emailService.isConfigured()}`);

  if (emailService.isConfigured()) {
    throw new Error('Test requirement failed: SMTP provider should NOT be configured.');
  }

  // Initialize DB
  await dbService.init();

  // Spin up temporary Express server with apiRouter on an ephemeral port
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`[TEST SETUP] Test HTTP Server listening at ${baseUrl}\n`);

  const results: Record<string, 'PASSED' | 'FAILED' | 'NOT VERIFIED'> = {};

  async function postJson(endpoint: string, body: any, headers: Record<string, string> = {}) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  async function getJson(endpoint: string, headers: Record<string, string> = {}) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  const testEmail = `prod_test_${Date.now()}@rayvacloud.test`;
  const testPassword = 'SecurePassword!123';
  const testName = 'Production User';

  // ----------------------------------------------------
  // TEST 1: Production Signup with no SMTP/email provider configured
  // ----------------------------------------------------
  console.log('--- TEST 1: Production Signup Test ---');
  const signupRes = await postJson('/auth/signup', {
    name: testName,
    email: testEmail,
    password: testPassword,
    role: 'operator',
  });

  console.log(`Signup HTTP Status: ${signupRes.status}`);
  console.log(`Signup Response Message: "${signupRes.data?.message}"`);
  console.log(`Signup devVerificationToken: ${signupRes.data?.devVerificationToken}`);
  console.log(`Signup emailDeliveryConfigured: ${signupRes.data?.emailDeliveryConfigured}`);

  const hasNoFakeEmailClaim = !signupRes.data?.message?.toLowerCase().includes('dispatched') &&
                              !signupRes.data?.message?.toLowerCase().includes('sent') &&
                              signupRes.data?.message?.toLowerCase().includes('offline');
  const devTokenHiddenInProd = signupRes.data?.devVerificationToken === undefined;
  const emailDeliveryFlagFalse = signupRes.data?.emailDeliveryConfigured === false;
  const unverifiedFlagTrue = signupRes.data?.unverified === true;

  if (signupRes.status === 201 && hasNoFakeEmailClaim && devTokenHiddenInProd && emailDeliveryFlagFalse && unverifiedFlagTrue) {
    results['Production Signup (No Fake Email Claim, Token Omitted, Offline Notice)'] = 'PASSED';
    console.log('✓ TEST 1 PASSED\n');
  } else {
    results['Production Signup (No Fake Email Claim, Token Omitted, Offline Notice)'] = 'FAILED';
    console.error('✗ TEST 1 FAILED\n');
  }

  // Verify account state in DB
  const dbUser = dbService.getUserByEmail(testEmail);
  if (dbUser && dbUser.email_verified === 0 && dbUser.email_verification_token_hash) {
    console.log(`[DB Check] User ${testEmail} exists with email_verified = 0 and token hash stored.`);
    results['Account Stored in Unverified State with Hashed Token'] = 'PASSED';
  } else {
    console.error(`[DB Check Failed] User state incorrect:`, dbUser);
    results['Account Stored in Unverified State with Hashed Token'] = 'FAILED';
  }

  // Verify production logs do not leak raw token
  const recentLogs = logger.getLogs(50);
  const leakedRawTokenInLogs = recentLogs.some(l => l.message.includes('vfy-') || (l.metadata && JSON.stringify(l.metadata).includes('vfy-')));
  if (!leakedRawTokenInLogs) {
    console.log('[Log Security Check] Verified zero raw verification tokens in system logs.');
    results['No Raw Token in Production Logs'] = 'PASSED';
  } else {
    console.error('[Log Security Check] Found token in logs!');
    results['No Raw Token in Production Logs'] = 'FAILED';
  }

  // ----------------------------------------------------
  // TEST 2: Unverified Login Rejection
  // ----------------------------------------------------
  console.log('--- TEST 2: Unverified Login Rejection ---');
  const unverifiedLoginRes = await postJson('/auth/login', {
    email: testEmail,
    password: testPassword,
  });

  console.log(`Login HTTP Status: ${unverifiedLoginRes.status}`);
  console.log(`Login Error Message: "${unverifiedLoginRes.data?.error}"`);
  if (unverifiedLoginRes.status === 403 && unverifiedLoginRes.data?.unverified === true) {
    results['Unverified Login Blocked with 403'] = 'PASSED';
    console.log('✓ TEST 2 PASSED\n');
  } else {
    results['Unverified Login Blocked with 403'] = 'FAILED';
    console.error('✗ TEST 2 FAILED\n');
  }

  // ----------------------------------------------------
  // TEST 3: Invalid Token Verification Test
  // ----------------------------------------------------
  console.log('--- TEST 3: Invalid Token Test ---');
  const invalidTokenRes = await postJson('/auth/verify-email', {
    token: 'vfy-invalid-token-1234567890abcdef',
  });
  console.log(`Invalid Token HTTP Status: ${invalidTokenRes.status}`);
  console.log(`Invalid Token Error: "${invalidTokenRes.data?.error}"`);
  if (invalidTokenRes.status === 400 && invalidTokenRes.data?.error?.includes('Invalid or expired')) {
    results['Invalid Token Rejected (400)'] = 'PASSED';
    console.log('✓ TEST 3 PASSED\n');
  } else {
    results['Invalid Token Rejected (400)'] = 'FAILED';
    console.error('✗ TEST 3 FAILED\n');
  }

  // ----------------------------------------------------
  // TEST 4: Expired Token Test
  // ----------------------------------------------------
  console.log('--- TEST 4: Expired Token Test ---');
  // Create an expired token in DB for testing
  const expiredRawToken = `vfy-expired-${crypto.randomBytes(16).toString('hex')}`;
  const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
  const expiredEmail = `expired_${Date.now()}@rayvacloud.test`;
  
  dbService.createUser({
    id: `usr_${Date.now()}_exp`,
    email: expiredEmail,
    name: 'Expired User',
    password: 'Password123!',
    role: 'operator',
    emailVerified: 0,
    verificationTokenHash: expiredHash,
    verificationExpires: Date.now() - 3600000, // Expired 1 hour ago
  });

  const expiredVerifyRes = await postJson('/auth/verify-email', {
    token: expiredRawToken,
  });
  console.log(`Expired Token HTTP Status: ${expiredVerifyRes.status}`);
  console.log(`Expired Token Error: "${expiredVerifyRes.data?.error}"`);
  if (expiredVerifyRes.status === 400 && expiredVerifyRes.data?.error?.includes('expired')) {
    results['Expired Token Rejected (400)'] = 'PASSED';
    console.log('✓ TEST 4 PASSED\n');
  } else {
    results['Expired Token Rejected (400)'] = 'FAILED';
    console.error('✗ TEST 4 FAILED\n');
  }

  // ----------------------------------------------------
  // TEST 5: Successful Verification Test
  // ----------------------------------------------------
  console.log('--- TEST 5: Valid Token Verification Test ---');
  // Generate a known valid token for testEmail directly via DB method
  const validRawToken = `vfy-valid-${crypto.randomBytes(16).toString('hex')}`;
  const validHash = crypto.createHash('sha256').update(validRawToken).digest('hex');
  const userBeforeTokenSet = dbService.getUserByEmail(testEmail);
  dbService.setVerificationToken(userBeforeTokenSet.id, validHash, Date.now() + 86400000);

  const validVerifyRes = await postJson('/auth/verify-email', {
    token: validRawToken,
  });
  console.log(`Valid Token HTTP Status: ${validVerifyRes.status}`);
  console.log(`Valid Token Message: "${validVerifyRes.data?.message}"`);

  const dbUserAfterVerify = dbService.getUserByEmail(testEmail);
  if (
    validVerifyRes.status === 200 &&
    dbUserAfterVerify?.email_verified === 1 &&
    dbUserAfterVerify?.email_verification_token_hash === null
  ) {
    results['Valid Token Verification & Account Activation'] = 'PASSED';
    console.log('✓ TEST 5 PASSED\n');
  } else {
    results['Valid Token Verification & Account Activation'] = 'FAILED';
    console.error('✗ TEST 5 FAILED\n');
  }

  // ----------------------------------------------------
  // TEST 6: Token Reuse Test
  // ----------------------------------------------------
  console.log('--- TEST 6: Token Reuse Test ---');
  const reusedTokenRes = await postJson('/auth/verify-email', {
    token: validRawToken,
  });
  console.log(`Reused Token HTTP Status: ${reusedTokenRes.status}`);
  console.log(`Reused Token Error: "${reusedTokenRes.data?.error}"`);
  if (reusedTokenRes.status === 400) {
    results['Token Reuse Rejected (Single-Use Guarantee)'] = 'PASSED';
    console.log('✓ TEST 6 PASSED\n');
  } else {
    results['Token Reuse Rejected (Single-Use Guarantee)'] = 'FAILED';
    console.error('✗ TEST 6 FAILED\n');
  }

  // ----------------------------------------------------
  // TEST 7: Verified User Can Now Login
  // ----------------------------------------------------
  console.log('--- TEST 7: Verified User Login ---');
  const verifiedLoginRes = await postJson('/auth/login', {
    email: testEmail,
    password: testPassword,
  });
  console.log(`Verified Login HTTP Status: ${verifiedLoginRes.status}`);
  if (verifiedLoginRes.status === 200 && verifiedLoginRes.data?.token && verifiedLoginRes.data?.user?.emailVerified === true) {
    results['Verified User Login Granted with Session Token'] = 'PASSED';
    console.log('✓ TEST 7 PASSED\n');
  } else {
    results['Verified User Login Granted with Session Token'] = 'FAILED';
    console.error('✗ TEST 7 FAILED\n');
  }

  // ----------------------------------------------------
  // TEST 8: Resend Verification & Rate Limiting Test
  // ----------------------------------------------------
  console.log('--- TEST 8: Resend Verification & Rate Limiting Test ---');
  const rateLimitEmail = `ratelimit_${Date.now()}@rayvacloud.test`;
  // Create an unverified user
  dbService.createUser({
    id: `usr_${Date.now()}_rl`,
    email: rateLimitEmail,
    name: 'Rate Limit Test User',
    password: 'Password123!',
    role: 'operator',
    emailVerified: 0,
    verificationTokenHash: 'somehash',
    verificationExpires: Date.now() + 86400000,
  });

  let hitRateLimit = false;
  let resendCount = 0;
  // resendVerificationLimiter windowMs: 15 mins, max: 10
  for (let i = 0; i < 13; i++) {
    const res = await postJson('/auth/resend-verification', { email: rateLimitEmail });
    resendCount++;
    if (res.status === 429) {
      hitRateLimit = true;
      console.log(`Rate limit triggered on attempt ${i + 1} with HTTP 429: "${res.data?.error}"`);
      break;
    }
  }

  if (hitRateLimit) {
    results['Resend Verification Rate Limiting (429)'] = 'PASSED';
    console.log('✓ TEST 8 PASSED\n');
  } else {
    results['Resend Verification Rate Limiting (429)'] = 'FAILED';
    console.error('✗ TEST 8 FAILED\n');
  }

  // ----------------------------------------------------
  // TEST 9: Existing Admin Login Test
  // ----------------------------------------------------
  console.log('--- TEST 9: Existing Admin Login Test ---');
  const adminUser = dbService.getUserByEmail('admin@rayva.io');
  console.log(`Admin user in DB: emailVerified = ${adminUser?.email_verified}, role = ${adminUser?.role}`);

  const adminPass = process.env.RAYVA_ADMIN_PASSWORD;
  if (!adminPass) {
    console.warn('⚠️ RAYVA_ADMIN_PASSWORD environment variable is not set. Skipping live admin password login attempt.');
    if (adminUser?.email_verified === 1 && adminUser?.role === 'Cluster Admin') {
      results['Existing Admin Account Preserved & Verified'] = 'PASSED';
      console.log('✓ Admin user verified in DB (email_verified = 1, role = Cluster Admin)\n');
    } else {
      results['Existing Admin Account Preserved & Verified'] = 'FAILED';
      console.error('✗ TEST 9 FAILED: Admin user invalid in DB\n');
    }
  } else {
    const adminLoginRes = await postJson('/auth/login', {
      email: 'admin@rayva.io',
      password: adminPass,
    });
    console.log(`Admin Login HTTP Status: ${adminLoginRes.status}`);
    if (adminLoginRes.status === 200 && adminLoginRes.data?.user?.role === 'Cluster Admin') {
      results['Existing Admin Account Preserved & Verified'] = 'PASSED';
      console.log('✓ TEST 9 PASSED\n');
    } else {
      results['Existing Admin Account Preserved & Verified'] = 'FAILED';
      console.error('✗ TEST 9 FAILED: Admin login response invalid\n');
    }
  }

  // Clean up server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log('\n====================================================');
  console.log('FINAL TEST EXECUTION SUMMARY:');
  console.log('====================================================');
  for (const [testName, result] of Object.entries(results)) {
    console.log(`${result === 'PASSED' ? '✓' : '✗'} [${result}] ${testName}`);
  }
  console.log('====================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test Suite Unhandled Exception:', err);
  process.exit(1);
});
