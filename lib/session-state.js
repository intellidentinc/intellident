import { prisma } from '@/lib/prisma';

export const SESSION_HARD_LIMIT_MS = 8 * 60 * 60 * 1000;

export function sessionIdleSeconds(rememberMe) {
  return rememberMe ? 3 * 24 * 60 * 60 : 10 * 60;
}

export async function resolveSession(session, renew = false, database = prisma) {
  if (!session?.sessionToken || !session.userId) return null;
  const now = new Date();
  const stored = await database.userSession.findUnique({
    where: { sessionToken: session.sessionToken },
    include: { user: { include: { clinic: true } } },
  });
  if (!stored || stored.terminatedAt || stored.expiresAt <= now || stored.userId !== session.userId) return null;
  const { user } = stored;
  const createdAt = Math.min(stored.createdAt.getTime(), Number(session.sessionCreatedAt));
  if (!Number.isFinite(createdAt) || createdAt > now.getTime() || now.getTime() - createdAt >= SESSION_HARD_LIMIT_MS) return null;
  if (!user.isActive || user.isDeleted || (session.role != null && session.role !== user.role)) return null;
  if ((stored.clinicId ?? null) !== (session.clinicId ?? null)) return null;
  if (user.role !== 0 && user.role !== 4 && user.clinicId !== session.clinicId) return null;
  if (session.clinicId) {
    const clinic = await database.clinic.findUnique({ where: { id: session.clinicId } });
    if (!clinic || clinic.isDeleted || (user.role !== 0 && !clinic.isEnabled)) return null;
    if (user.role === 4) {
      const patient = await database.patient.findUnique({
        where: { userId_clinicId: { userId: user.id, clinicId: session.clinicId } },
        select: { isDeleted: true },
      });
      if (!patient || patient.isDeleted) return null;
    }
  } else if (user.role !== 0) return null;
  if (renew) {
    const renewed = await database.userSession.updateMany({
      where: { id: stored.id, terminatedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: new Date(Math.min(now.getTime() + sessionIdleSeconds(session.rememberMe) * 1000, createdAt + SESSION_HARD_LIMIT_MS)) },
    });
    if (renewed.count !== 1) return null;
  }
  const passwordExpired = Boolean(user.clinic?.passwordExpiryEnabled &&
    user.clinic.passwordExpiryRoles?.includes(user.role) && user.passwordExpiresAt && user.passwordExpiresAt <= now);
  return {
    ...session, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName,
    superAdmin: user.role === 0 && Boolean(session.clinicId), requiresTerms: !user.termsAcceptedAt,
    mustChangePassword: user.mustChangePassword || passwordExpired, passwordExpired, sessionCreatedAt: createdAt,
  };
}

export async function revokeUserSessions(userId, database = prisma) {
  await database.userSession.updateMany({ where: { userId, terminatedAt: null }, data: { terminatedAt: new Date() } });
  await database.mfaOtp.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const user = await database.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user) await database.passwordResetToken.updateMany({ where: { email: user.email, usedAt: null }, data: { usedAt: new Date() } });
}
