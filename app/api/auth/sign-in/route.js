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
import { NextResponse, after } from 'next/server';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getRequestMeta, logAudit } from '@/lib/audit';
import { parseJsonBody, sanitizeEmail, secret, bool } from '@/lib/validate';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendMfaOtpEmail, sendAccountLockedAlert } from '@/lib/email';

// Configurable lockout constants (override via env vars)
const MAX_ATTEMPTS     = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS      ?? '5');
const WINDOW_MS        = parseInt(process.env.LOCKOUT_WINDOW_MINUTES    ?? '5')  * 60 * 1000;
const LOCK_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MINUTES  ?? '15') * 60 * 1000;

// Generic credential error — identical for "unknown email" and "wrong password"
// so the response cannot be used to enumerate which emails are registered.
const INVALID_CREDENTIALS = 'Invalid email or password.';

// A real cost-10 bcrypt hash of a throwaway random string. When no user exists,
// we still run bcrypt.compare against this so the response time matches the
// real-user path and closes the timing side-channel.
const DUMMY_HASH = '$2b$10$jtrtp9o.NH0UwwP3zEE8leTJvkenXS2YO56rTyN21XlAAgsjeLS7m';

export async function POST(request) {
  try {
    const { ip, userAgent } = getRequestMeta(request);

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

    // PHASE 0: Rate-limit check + user lookup in parallel (saves 1 DB round-trip)
    const [{ allowed }, user] = await Promise.all([
      checkRateLimit(`${ip}:sign-in`, 20, 15 * 60),
      prisma.user.findUnique({ where: { email } }),
    ]);

    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    if (!user || user.isDeleted) {
      // Run bcrypt against a dummy hash so the no-user path takes the same time
      // as a real comparison (kills the timing oracle), then return the generic
      // error that's byte-identical to the wrong-password response.
      await bcrypt.compare(password, DUMMY_HASH);
      return NextResponse.json(
        { error: INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    // Note: the deactivated-account check is deliberately deferred until AFTER the
    // password is verified (see below) so account status cannot be probed without
    // valid credentials.

    // Check if account is currently locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account locked. Try again in ${remainingMinutes} minute(s).` },
        { status: 423 }
      );
    }

    // PHASE 1: bcrypt (CPU-bound, unavoidable)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const now = new Date();
      const windowStart = new Date(now.getTime() - WINDOW_MS);

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

      logAudit({
        userId: user.id, clinicId: user.clinicId,
        action: 'LOGIN_FAILED', entity: 'User', entityId: user.id,
        ipAddress: ip, userAgent,
        metadata: { attempt: attemptsInWindow, maxAttempts: MAX_ATTEMPTS },
      });

      if (shouldLock) {
        logAudit({
          userId: user.id, clinicId: user.clinicId,
          action: 'LOCKOUT', entity: 'User', entityId: user.id,
          ipAddress: ip, userAgent,
          metadata: { attempts: attemptsInWindow, lockedUntil },
        });
        after(sendAccountLockedAlert({ to: user.email, firstName: user.firstName, lockedUntil }).catch((err) => console.error('sendAccountLockedAlert failed:', err)));
        const lockMinutes = LOCK_DURATION_MS / 60000;
        return NextResponse.json(
          { error: `Too many failed attempts. Account locked for ${lockMinutes} minutes.` },
          { status: 423 }
        );
      }

      // Generic response (no remaining-attempts count) so a wrong password is
      // indistinguishable from an unknown email.
      return NextResponse.json(
        { error: INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    // Password is valid — only now reveal a deactivated-account status, which
    // requires the attacker to already know the correct password.
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact your administrator.' },
        { status: 403 }
      );
    }

    if (!user.wrappedKey || !user.keySalt) {
      return NextResponse.json(
        { error: 'Account setup is incomplete. Please contact your administrator.' },
        { status: 500 }
      );
    }

    // PHASE 2: Reset lockout + clinic check in parallel (saves 1 DB round-trip)
    const [, clinic] = await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lastFailedAt: null, lockedUntil: null },
      }),
      user.clinicId
        ? prisma.clinic.findUnique({
            where: { id: user.clinicId },
            select: { isEnabled: true, passwordExpiryEnabled: true, passwordExpiryRoles: true, singleSessionEnabled: true },
          })
        : Promise.resolve(null),
    ]);

    if (user.clinicId && (!clinic || !clinic.isEnabled)) {
      return NextResponse.json(
        { error: 'This clinic has been disabled. Please contact support.' },
        { status: 403 }
      );
    }

    // MFA (email OTP) step — credentials are valid; issue a one-time code and defer session
    // creation to POST /api/auth/verify-otp, which runs finalizeLogin() once the code is confirmed.
    const otp = String(crypto.randomInt(100000, 1000000));
    const pendingToken = crypto.randomBytes(32).toString('hex');
    const codeHash = await bcrypt.hash(otp, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.mfaOtp.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.mfaOtp.create({
      data: { userId: user.id, pendingToken, codeHash, rememberMe, expiresAt },
    });

    try {
      await sendMfaOtpEmail({ to: user.email, firstName: user.firstName, code: otp });
    } catch (emailError) {
      console.error('Failed to send MFA OTP email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send the verification code email. Please try again.' },
        { status: 502 }
      );
    }

    // E2EE key material (wrappedKey/keySalt) is intentionally NOT returned here.
    // Returning it before the OTP is verified would let a password-only attacker
    // exfiltrate it and decrypt records offline, defeating MFA. It is handed to the
    // client only after a successful OTP check in POST /api/auth/verify-otp.
    return NextResponse.json(
      { mfaPending: true, pendingToken },
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
