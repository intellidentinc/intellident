import { cookies } from 'next/headers';
import crypto from 'crypto';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { signPayload, verifyCookie } from '@/lib/session-cookie';

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

  const dbSession = await prisma.userSession.findUnique({
    where: { sessionToken: session.sessionToken },
    select: { terminatedAt: true },
  });
  if (!dbSession || dbSession.terminatedAt) return null;

  return session;
});

export async function setSession(
  userId, email, firstName, lastName, clinicId,
  rememberMe = false, superAdmin = false, requiresTerms = false,
  ip = null, userAgent = null, role = null, suspicious = false
) {
  const cookieStore = await cookies();

  // Terminate any existing session token before creating a new one
  const existing = cookieStore.get('user')?.value;
  if (existing) {
    const prev = verifyCookie(existing);
    if (prev?.sessionToken) {
      await prisma.userSession.updateMany({
        where: { sessionToken: prev.sessionToken, terminatedAt: null },
        data: { terminatedAt: new Date() },
      });
    }
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const maxAge = rememberMe ? 60 * 60 * 24 * 3 : 60 * 10;
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  await prisma.userSession.create({
    data: { userId, clinicId: clinicId || null, sessionToken, ipAddress: ip, userAgent, expiresAt },
  });

  const payload = {
    userId,
    email,
    firstName,
    lastName,
    clinicId: clinicId || null,
    rememberMe: !!rememberMe,
    sessionCreatedAt: Date.now(),
    sessionToken,
    ...(role !== null && { role }),
  };
  if (superAdmin) payload.superAdmin = true;
  if (requiresTerms) payload.requiresTerms = true;
  if (suspicious) payload.suspiciousSession = true;

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

export async function grantStepUp() {
  const cookieStore = await cookies();
  const userDataStr = cookieStore.get('user')?.value;
  if (!userDataStr) return false;

  const session = verifyCookie(userDataStr);
  if (!session) return false;

  session.stepUpGrantedAt = Date.now();
  delete session.suspiciousSession;
  cookieStore.set('user', signPayload(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: session.rememberMe ? 60 * 60 * 24 * 3 : 60 * 10,
  });
  return true;
}

export function isStepUpValid(session) {
  if (!session?.stepUpGrantedAt) return false;
  return Date.now() - session.stepUpGrantedAt < STEP_UP_TTL_MS;
}

export function isSuspiciousSession(session) {
  return session?.suspiciousSession === true;
}
