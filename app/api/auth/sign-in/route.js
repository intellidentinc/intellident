/**
 * POST /api/auth/sign-in
 *
 * Key features implemented here:
 *
 * 1. Account Lockout (Brute-Force Protection)
 *    Tracks failed attempts on the User record. After MAX_ATTEMPTS failures within
 *    WINDOW_MS, the account is locked for LOCK_DURATION_MS. Configurable via env vars.
 *    Resets on successful login.
 *
 * 2. E2EE Key Material Handoff
 *    On success, the server returns `wrappedKey` and `keySalt` to the client.
 *    The browser re-derives the KEK from the user's password + keySalt (PBKDF2),
 *    then unwraps the master key locally. The server never sees the plaintext key.
 *
 * 3. Remember Me
 *    Passes `rememberMe` to setSession — extends cookie maxAge from 10 min to 3 days.
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
// import crypto from 'crypto'; // MFA: not needed while OTP is disabled
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';
import { getRequestMeta, logAudit } from '@/lib/audit';
import { parseJsonBody, sanitizeEmail, secret, bool } from '@/lib/validate';
import { checkRateLimit } from '@/lib/rateLimit';
// import { sendMfaOtpEmail } from '@/lib/email'; // MFA: disabled

// Configurable lockout constants (override via env vars)
const MAX_ATTEMPTS     = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS      ?? '5');
const WINDOW_MS        = parseInt(process.env.LOCKOUT_WINDOW_MINUTES    ?? '5')  * 60 * 1000;
const LOCK_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MINUTES  ?? '15') * 60 * 1000;

export async function POST(request) {
  try {
    const { ip, userAgent } = getRequestMeta(request);

    const { allowed } = await checkRateLimit(`${ip}:sign-in`, 20, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const parsed = await parseJsonBody(request);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { body } = parsed;

    const email = sanitizeEmail(body.email);
    const password = secret(body.password, 128);
    const rememberMe = bool(body.rememberMe);

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.isDeleted) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact your administrator.' },
        { status: 403 }
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

    // Successful credentials — reset lockout fields
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastFailedAt: null, lockedUntil: null },
    });

    // MFA (OTP) step disabled — skipping OTP generation and proceeding directly to session creation
    // ------- MFA BLOCK START (commented out) -------
    // const otp = String(Math.floor(100000 + Math.random() * 900000));
    // const pendingToken = crypto.randomBytes(32).toString('hex');
    // const codeHash = await bcrypt.hash(otp, 8);
    // const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    // await prisma.mfaOtp.deleteMany({ where: { userId: user.id, usedAt: null } });
    // await prisma.mfaOtp.create({
    //   data: { userId: user.id, pendingToken, codeHash, rememberMe, expiresAt },
    // });
    // sendMfaOtpEmail({ to: user.email, firstName: user.firstName, code: otp }).catch(() => {});
    // return NextResponse.json(
    //   { mfaPending: true, pendingToken, wrappedKey: user.wrappedKey, keySalt: user.keySalt },
    //   { status: 200 }
    // );
    // ------- MFA BLOCK END -------

    await setSession(user.id, user.email, user.firstName, user.lastName, user.clinicId, rememberMe);

    logAudit({ userId: user.id, clinicId: user.clinicId, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: ip, userAgent });

    return NextResponse.json(
      {
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
