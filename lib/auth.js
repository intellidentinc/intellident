import { cookies } from 'next/headers';
import crypto from 'crypto';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';

const STEP_UP_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const getSession = cache(async function getSession() {
  const cookieStore = await cookies();
  const userDataStr = cookieStore.get('user')?.value;

  if (!userDataStr) return null;

  try {
    const session = JSON.parse(userDataStr);

    if (session.sessionToken) {
      const dbSession = await prisma.userSession.findUnique({
        where: { sessionToken: session.sessionToken },
        select: { terminatedAt: true },
      });
      if (!dbSession || dbSession.terminatedAt) return null;
    }

    return session;
  } catch {
    return null;
  }
});

export async function setSession(
  userId, email, firstName, lastName, clinicId,
  rememberMe = false, superAdmin = false, requiresTerms = false,
  ip = null, userAgent = null, role = null
) {
  const cookieStore = await cookies();

  // Terminate any existing session token before creating a new one
  const existing = cookieStore.get('user')?.value;
  if (existing) {
    try {
      const prev = JSON.parse(existing);
      if (prev.sessionToken) {
        await prisma.userSession.updateMany({
          where: { sessionToken: prev.sessionToken, terminatedAt: null },
          data: { terminatedAt: new Date() },
        });
      }
    } catch {}
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

  cookieStore.set('user', JSON.stringify(payload), {
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
    try {
      const session = JSON.parse(userDataStr);
      if (session.sessionToken) {
        await prisma.userSession.updateMany({
          where: { sessionToken: session.sessionToken, terminatedAt: null },
          data: { terminatedAt: new Date() },
        });
      }
    } catch {}
  }

  cookieStore.delete('user');
}

export async function grantStepUp() {
  const cookieStore = await cookies();
  const userDataStr = cookieStore.get('user')?.value;
  if (!userDataStr) return false;

  try {
    const session = JSON.parse(userDataStr);
    session.stepUpGrantedAt = Date.now();
    cookieStore.set('user', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: session.rememberMe ? 60 * 60 * 24 * 3 : 60 * 10,
    });
    return true;
  } catch {
    return false;
  }
}

export function isStepUpValid(session) {
  if (!session?.stepUpGrantedAt) return false;
  return Date.now() - session.stepUpGrantedAt < STEP_UP_TTL_MS;
}
