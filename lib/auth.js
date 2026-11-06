import { cookies } from 'next/headers';
import crypto from 'crypto';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { signPayload, verifyCookie } from '@/lib/session-cookie';
import { resolveSession, SESSION_HARD_LIMIT_MS, sessionIdleSeconds } from '@/lib/session-state';

const STEP_UP_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const getSession = cache(async function getSession() {
  const cookieStore = await cookies();
  const userDataStr = cookieStore.get('user')?.value;

  if (!userDataStr) return null;

  // Reject any cookie that is not validly HMAC-signed (forged or tampered).
  const session = verifyCookie(userDataStr);
  if (!session) return null;

  // A live server-side session token is now mandatory — no token, no session.
  if (!session.sessionToken) return null;

  return resolveSession(session);
});

export const getAuthContext = cache(async function getAuthContext() {
  const session = await getSession();
  if (!session) return null;

  return { ...session, id: session.userId };
});

export async function setSession(
  userId, email, firstName, lastName, clinicId,
  rememberMe = false, superAdmin = false, requiresTerms = false,
  ip = null, userAgent = null, role = null, suspicious = false,
  mustChangePassword = false, expectedPasswordHash = null
) {
  const cookieStore = await cookies();
  let sessionCreatedAt = Date.now();
  const previousCookie = cookieStore.get('user')?.value;
  const previousPayload = previousCookie ? verifyCookie(previousCookie) : null;
  const sessionToken = crypto.randomBytes(32).toString('hex');
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const account = await transaction.user.findUnique({ where: { id: userId }, include: { clinic: true } });
    if (!account?.isActive || account.isDeleted || (role != null && role !== account.role) || account.email !== email ||
      (expectedPasswordHash && account.password !== expectedPasswordHash)) throw new Error('Account changed. Sign in again.');
    const previous = await resolveSession(previousPayload, false, transaction);
    if (!expectedPasswordHash && previous?.userId !== userId) throw new Error('Session expired. Sign in again.');
    if (previous?.userId === userId) {
      sessionCreatedAt = previous.sessionCreatedAt;
      suspicious = suspicious || previous.suspiciousSession;
    }
    if (Date.now() >= sessionCreatedAt + SESSION_HARD_LIMIT_MS) throw new Error('Session expired. Sign in again.');
    if (previousPayload?.sessionToken) {
      await transaction.userSession.updateMany({ where: { sessionToken: previousPayload.sessionToken, terminatedAt: null }, data: { terminatedAt: new Date() } });
    }
    if (expectedPasswordHash && account.clinic?.singleSessionEnabled) {
      await transaction.userSession.updateMany({ where: { userId, terminatedAt: null }, data: { terminatedAt: new Date() } });
    }
    const expiresAt = new Date(Math.min(Date.now() + sessionIdleSeconds(rememberMe) * 1000, sessionCreatedAt + SESSION_HARD_LIMIT_MS));
    await transaction.userSession.create({
      data: { userId, clinicId: clinicId || null, sessionToken, ipAddress: ip, userAgent, expiresAt },
    });
  });
  const maxAge = Math.max(1, Math.floor((sessionCreatedAt + SESSION_HARD_LIMIT_MS - Date.now()) / 1000));

  const payload = {
    userId,
    email,
    firstName,
    lastName,
    clinicId: clinicId || null,
    rememberMe: !!rememberMe,
    sessionCreatedAt,
    sessionToken,
    ...(role !== null && { role }),
  };
  if (superAdmin) payload.superAdmin = true;
  if (requiresTerms) payload.requiresTerms = true;
  if (suspicious) payload.suspiciousSession = true;
  if (mustChangePassword) payload.mustChangePassword = true;

  cookieStore.set('user', signPayload(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const userDataStr = cookieStore.get('user')?.value;

  if (userDataStr) {
    const session = verifyCookie(userDataStr);
    if (session?.sessionToken) {
      await prisma.userSession.updateMany({
        where: { sessionToken: session.sessionToken, terminatedAt: null },
        data: { terminatedAt: new Date() },
      });
    }
  }

  cookieStore.delete('user');
}

export async function grantStepUp(mode = 'password') {
  const cookieStore = await cookies();
  const userDataStr = cookieStore.get('user')?.value;
  if (!userDataStr) return false;

  const session = await resolveSession(verifyCookie(userDataStr));
  if (!session) return false;

  session.stepUpGrantedAt = Date.now();
  session.stepUpMode = mode;
  delete session.suspiciousSession;
  cookieStore.set('user', signPayload(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.max(1, Math.floor((session.sessionCreatedAt + SESSION_HARD_LIMIT_MS - Date.now()) / 1000)),
  });
  return true;
}

export function isStepUpValid(session, mode = null) {
  if (!session?.stepUpGrantedAt) return false;
  const age = Date.now() - session.stepUpGrantedAt;
  return age >= 0 && age < STEP_UP_TTL_MS && (!mode || session.stepUpMode === mode);
}

export function isSuspiciousSession(session) {
  return session?.suspiciousSession === true;
}
