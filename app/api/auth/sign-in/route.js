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
import { prisma } from '@/lib/prisma';
import { getRequestMeta, logAudit } from '@/lib/audit';
import { parseJsonBody, sanitizeEmail, secret, bool } from '@/lib/validate';
import { checkRateLimit } from '@/lib/rateLimit';
import { issueOtp } from '@/lib/otp';
import { verifyLoginPassword } from '@/lib/login-attempts';
import { sendMfaOtpEmail, sendAccountLockedAlert } from '@/lib/email';

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
    const [{ allowed }, candidate] = await Promise.all([
      checkRateLimit(`${ip}:sign-in`, 20, 15 * 60),
      prisma.user.findUnique({ where: { email } }),
    ]);

    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    if (!candidate || candidate.isDeleted) {
      // Run bcrypt against a dummy hash so the no-user path takes the same time
      // as a real comparison (kills the timing oracle), then return the generic
      // error that's byte-identical to the wrong-password response.
      await bcrypt.compare(password, DUMMY_HASH);
      return NextResponse.json(
        { error: INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    const result = await verifyLoginPassword(candidate.id, password);
    const { user } = result;
    if (!result.valid) {
      if (result.attempts) logAudit({
        userId: user.id, clinicId: user.clinicId,
        action: 'LOGIN_FAILED', entity: 'User', entityId: user.id,
        ipAddress: ip, userAgent,
        metadata: { attempt: result.attempts, maxAttempts: result.maxAttempts },
      });

      if (result.newlyLocked) {
        logAudit({
          userId: user.id, clinicId: user.clinicId,
          action: 'LOCKOUT', entity: 'User', entityId: user.id,
          ipAddress: ip, userAgent,
          metadata: { attempts: result.attempts, lockedUntil: result.lockedUntil },
        });
        after(sendAccountLockedAlert({ to: user.email, firstName: user.firstName, lockedUntil: result.lockedUntil }).catch((err) => console.error('sendAccountLockedAlert failed:', err)));
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

    // The lockout reset happened under the same row lock as password verification.
    const clinic = user.clinicId
        ? await prisma.clinic.findUnique({
            where: { id: user.clinicId },
            select: { isEnabled: true, passwordExpiryEnabled: true, passwordExpiryRoles: true, singleSessionEnabled: true },
          })
        : null;

    if (user.clinicId && (!clinic || !clinic.isEnabled)) {
      return NextResponse.json(
        { error: 'This clinic has been disabled. Please contact support.' },
        { status: 403 }
      );
    }

    // MFA (email OTP) step — credentials are valid; issue a one-time code and defer session
    // creation to POST /api/auth/verify-otp, which runs finalizeLogin() once the code is confirmed.
    const { pendingToken, code: otp } = await issueOtp({ userId: user.id, purpose: 'login', rememberMe, expectedPasswordHash: user.password });

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
