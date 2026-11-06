import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_ATTEMPTS = positiveInteger(process.env.LOCKOUT_MAX_ATTEMPTS, 5);
const WINDOW_MS = positiveInteger(process.env.LOCKOUT_WINDOW_MINUTES, 5) * 60 * 1000;
const LOCK_DURATION_MS = positiveInteger(process.env.LOCKOUT_DURATION_MINUTES, 15) * 60 * 1000;

// Serialize the credential check and both failure/success updates on the user row.
// Reading after FOR UPDATE prevents concurrent requests from losing failures or
// clearing a lock established while they were waiting to verify a password.
export async function verifyLoginPassword(userId, password) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    const now = new Date();
    if (!user || user.isDeleted || (user.lockedUntil && user.lockedUntil > now)) {
      return { valid: false };
    }

    if (!(await bcrypt.compare(password, user.password))) {
      const attempts = user.lastFailedAt && user.lastFailedAt > new Date(now.getTime() - WINDOW_MS)
        ? user.failedLoginAttempts + 1
        : 1;
      const newlyLocked = attempts >= MAX_ATTEMPTS;
      const lockedUntil = newlyLocked ? new Date(now.getTime() + LOCK_DURATION_MS) : null;
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lastFailedAt: now, lockedUntil },
      });
      return { valid: false, user, attempts, maxAttempts: MAX_ATTEMPTS, newlyLocked, lockedUntil };
    }

    if (user.isActive) {
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lastFailedAt: null, lockedUntil: null },
      });
    }
    return { valid: true, user };
  });
}
