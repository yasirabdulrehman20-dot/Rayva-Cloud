import crypto from 'crypto';

interface DemoActivationRecord {
  userId: string;
  email: string;
  expiresAt: number;
}

// In-memory store of short-lived activation challenges (valid for 10 minutes)
const demoChallenges = new Map<string, DemoActivationRecord>();

// Cleanup stale challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of demoChallenges.entries()) {
    if (value.expiresAt < now) {
      demoChallenges.delete(key);
    }
  }
}, 60 * 1000);

export const demoModeService = {
  /**
   * Returns true if demo mode is enabled (either RAYVA_DEMO_MODE=true or non-production environment).
   */
  isDemoModeEnabled(): boolean {
    if (process.env.RAYVA_DEMO_MODE === 'true' || process.env.RAYVA_DEMO_MODE === '1') {
      return true;
    }
    return process.env.NODE_ENV !== 'production';
  },

  /**
   * Issues a secure, short-lived activation ticket for a newly registered public user.
   */
  issueActivationTicket(userId: string, email: string): string {
    const ticket = `demo-act-${crypto.randomBytes(24).toString('hex')}`;
    demoChallenges.set(ticket, {
      userId,
      email: email.trim().toLowerCase(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes TTL
    });
    return ticket;
  },

  /**
   * Consumes and validates an activation ticket.
   */
  consumeActivationTicket(ticket: string): DemoActivationRecord | null {
    if (!ticket || typeof ticket !== 'string') return null;
    const record = demoChallenges.get(ticket);
    if (!record) return null;

    demoChallenges.delete(ticket); // Single use guarantee

    if (Date.now() > record.expiresAt) {
      return null;
    }

    return record;
  },
};
