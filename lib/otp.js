import { createHash, randomBytes, randomInt } from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

function scopedToken(token, purpose, scope) {
  return createHash('sha256').update(JSON.stringify([purpose, scope, token])).digest('hex');
}

function credentialFingerprint(user) {
  return createHash('sha256').update(JSON.stringify([user.password, user.email, user.role, user.isActive, user.isDeleted])).digest('hex');
}

export async function issueOtp({ userId, purpose, scope = '', rememberMe = false, expectedPasswordHash = null }) {
  const pendingToken = randomBytes(32).toString('hex');
  const code = String(randomInt(100000, 1000000));
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isActive || user.isDeleted || (expectedPasswordHash && user.password !== expectedPasswordHash)) throw new Error('Account changed. Sign in again.');
  await prisma.mfaOtp.create({
    data: {
      userId, pendingToken: scopedToken(pendingToken, purpose, scope), rememberMe,
      codeHash: (await bcrypt.hash(code, 8)) + ':' + credentialFingerprint(user), expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return { pendingToken, code };
}

export async function consumeOtp({ pendingToken, code, purpose, scope = '', userId = null }) {
  const token = scopedToken(pendingToken, purpose, scope);
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5(${`otp:${token}`}), 1, 16))::bit(64)::bigint)`;
    const challenge = await transaction.mfaOtp.findUnique({ where: { pendingToken: token }, include: { user: true } });
    if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() ||
      (userId && challenge.userId !== userId) || !challenge.user.isActive || challenge.user.isDeleted) {
      return { error: 'Invalid or expired code. Please request a new one.', status: 400 };
    }
    const [codeHash, fingerprint] = challenge.codeHash.split(':');
    if (fingerprint !== credentialFingerprint(challenge.user)) return { error: 'Account changed. Please sign in again.', status: 400 };
    if (challenge.attempts >= 5) return { error: 'Too many incorrect attempts. Please request a new code.', status: 429 };
    if (!/^\d{6}$/.test(code) || !(await bcrypt.compare(code, codeHash))) {
      await transaction.mfaOtp.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      return { error: 'Incorrect code.', status: challenge.attempts >= 4 ? 429 : 401 };
    }
    await transaction.mfaOtp.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
    return { challenge };
  });
}
