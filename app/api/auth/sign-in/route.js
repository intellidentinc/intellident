import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';

// Configurable lockout constants (override via env vars)
const MAX_ATTEMPTS     = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS      ?? '5');
const WINDOW_MS        = parseInt(process.env.LOCKOUT_WINDOW_MINUTES    ?? '5')  * 60 * 1000;
const LOCK_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MINUTES  ?? '15') * 60 * 1000;

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if account is currently locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account locked. Try again in ${remainingMinutes} minute(s).` },
        { status: 423 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const now = new Date();
      const windowStart = new Date(now.getTime() - WINDOW_MS);

      // Count attempts only within the rolling window
      const attemptsInWindow =
        user.lastFailedAt && user.lastFailedAt > windowStart
          ? user.failedLoginAttempts + 1
          : 1;

      const shouldLock = attemptsInWindow >= MAX_ATTEMPTS;
      const lockedUntil = shouldLock ? new Date(now.getTime() + LOCK_DURATION_MS) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attemptsInWindow,
          lastFailedAt: now,
          ...(lockedUntil ? { lockedUntil } : {}),
        },
      });

      if (shouldLock) {
        const lockMinutes = LOCK_DURATION_MS / 60000;
        return NextResponse.json(
          { error: `Too many failed attempts. Account locked for ${lockMinutes} minutes.` },
          { status: 423 }
        );
      }

      const remaining = MAX_ATTEMPTS - attemptsInWindow;
      return NextResponse.json(
        { error: `Invalid credentials. ${remaining} attempt(s) remaining before lockout.` },
        { status: 401 }
      );
    }

    // Successful login — reset lockout fields
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastFailedAt: null, lockedUntil: null },
    });

    await setSession(user.id, user.email, user.firstName, user.lastName, user.clinicId);

    return NextResponse.json(
      {
        message: 'Signed in successfully',
        userId: user.id,
        clinicId: user.clinicId,
        wrappedKey: user.wrappedKey,
        keySalt: user.keySalt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
