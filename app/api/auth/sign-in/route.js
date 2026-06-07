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
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';
import { ROLES } from '@/lib/roles';
import { getRequestMeta, logAudit } from '@/lib/audit';
import { parseJsonBody, sanitizeEmail, secret, bool } from '@/lib/validate';
import { checkRateLimit } from '@/lib/rateLimit';
// import { sendMfaOtpEmail } from '@/lib/email'; // MFA: disabled
import { sendSuspiciousLoginAlert, sendAccountLockedAlert } from '@/lib/email';

// Configurable lockout constants (override via env vars)
const MAX_ATTEMPTS     = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS      ?? '5');
const WINDOW_MS        = parseInt(process.env.LOCKOUT_WINDOW_MINUTES    ?? '5')  * 60 * 1000;
const LOCK_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MINUTES  ?? '15') * 60 * 1000;

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
        sendAccountLockedAlert({ to: user.email, firstName: user.firstName, lockedUntil }).catch(() => {});
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
            select: { isEnabled: true, passwordExpiryEnabled: true, singleSessionEnabled: true },
          })
        : Promise.resolve(null),
    ]);

    if (user.clinicId && (!clinic || !clinic.isEnabled)) {
      return NextResponse.json(
        { error: 'This clinic has been disabled. Please contact support.' },
        { status: 403 }
      );
    }

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

    // PHASE 3: Single-session termination + device fingerprint in parallel (saves 1 DB round-trip)
    const uaHash = crypto.createHash('sha256').update(userAgent ?? '').digest('hex');

    const [, knownDevice] = await Promise.all([
      clinic?.singleSessionEnabled
        ? prisma.userSession.updateMany({
            where: { userId: user.id, terminatedAt: null },
            data: { terminatedAt: new Date() },
          })
        : Promise.resolve(),
      prisma.knownDevice.findUnique({
        where: { userId_userAgentHash: { userId: user.id, userAgentHash: uaHash } },
        select: { lastIp: true },
      }),
    ]);

    const isNewDevice  = !knownDevice;
    const suspiciousIp = !isNewDevice && knownDevice.lastIp !== null && knownDevice.lastIp !== ip;

    // PHASE 4: Device upsert + session creation in parallel (saves 1 DB round-trip)
    const requiresTerms = !user.termsAcceptedAt;
    await Promise.all([
      prisma.knownDevice.upsert({
        where:  { userId_userAgentHash: { userId: user.id, userAgentHash: uaHash } },
        create: { userId: user.id, userAgentHash: uaHash, lastIp: ip },
        update: { lastIp: ip, lastSeenAt: new Date() },
      }),
      setSession(user.id, user.email, user.firstName, user.lastName, user.clinicId,
                 rememberMe, false, requiresTerms, ip, userAgent, user.role),
    ]);

    logAudit({
      userId: user.id, clinicId: user.clinicId,
      action: 'LOGIN', entity: 'User', entityId: user.id,
      ipAddress: ip, userAgent,
      metadata: {
        ...(isNewDevice  ? { newDevice: true }                                      : {}),
        ...(suspiciousIp ? { suspiciousIp: true, previousIp: knownDevice.lastIp }  : {}),
      },
    });

    if (isNewDevice || suspiciousIp) {
      sendSuspiciousLoginAlert({
        to: user.email, firstName: user.firstName,
        isNewDevice, suspiciousIp,
        previousIp: suspiciousIp ? knownDevice.lastIp : null,
        ip, time: new Date(),
      }).catch(() => {});
    }

    const mustChangePassword = user.mustChangePassword ?? false;
    const passwordExpired =
      user.role === ROLES.ADMIN &&
      clinic?.passwordExpiryEnabled === true &&
      user.passwordExpiresAt instanceof Date &&
      user.passwordExpiresAt < new Date();

    return NextResponse.json(
      {
        clinicId: user.clinicId,
        wrappedKey: user.wrappedKey,
        keySalt: user.keySalt,
        ...(requiresTerms && { requiresTerms: true }),
        ...(mustChangePassword && { mustChangePassword: true }),
        ...(passwordExpired && { passwordExpired: true }),
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
