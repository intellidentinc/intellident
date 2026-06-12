/**
 * POST /api/auth/verify-otp
 *
 * Validates the 6-digit OTP issued during sign-in (MFA step 2).
 * On success: creates session and returns clinicId so client can redirect.
 * On failure: increments attempt counter; invalidates after 5 failed attempts.
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { finalizeLogin } from '@/lib/login';
import { getRequestMeta } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rateLimit';
import { parseJsonBody, hexToken, secret } from '@/lib/validate';

const MAX_OTP_ATTEMPTS = 5;

export async function POST(request) {
  try {
    const { ip, userAgent } = getRequestMeta(request);

    const { allowed } = await checkRateLimit(`${ip}:verify-otp`, 15, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const parsed = await parseJsonBody(request);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

    const pendingToken = hexToken(parsed.body.pendingToken);
    const code = secret(parsed.body.code, 16);

    if (!pendingToken || !code) {
      return NextResponse.json({ error: 'Missing token or code' }, { status: 400 });
    }

    const mfa = await prisma.mfaOtp.findUnique({
      where: { pendingToken },
      include: {
        user: {
          select: {
            id: true, email: true, firstName: true, lastName: true, clinicId: true, role: true,
            termsAcceptedAt: true, mustChangePassword: true, passwordExpiresAt: true,
            wrappedKey: true, keySalt: true,
            publicKey: true, encryptedPrivateKey: true, privateKeyIv: true,
          },
        },
      },
    });

    if (!mfa) {
      return NextResponse.json({ error: 'Invalid or expired session. Please sign in again.' }, { status: 400 });
    }

    if (mfa.usedAt) {
      return NextResponse.json({ error: 'This code has already been used. Please sign in again.' }, { status: 400 });
    }

    if (mfa.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Code has expired. Please sign in again.' }, { status: 400 });
    }

    if (mfa.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many incorrect attempts. Please sign in again.' }, { status: 429 });
    }

    const isValid = await bcrypt.compare(String(code).trim(), mfa.codeHash);

    if (!isValid) {
      const newAttempts = mfa.attempts + 1;
      await prisma.mfaOtp.update({ where: { id: mfa.id }, data: { attempts: newAttempts } });

      const remaining = MAX_OTP_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        return NextResponse.json({ error: 'Too many incorrect attempts. Please sign in again.' }, { status: 429 });
      }
      return NextResponse.json(
        { error: `Incorrect code. ${remaining} attempt(s) remaining.` },
        { status: 401 }
      );
    }

    // Mark OTP as used
    await prisma.mfaOtp.update({ where: { id: mfa.id }, data: { usedAt: new Date() } });

    const { user } = mfa;

    // Load clinic config + re-check it is still enabled (defense-in-depth between the two steps).
    const clinic = user.clinicId
      ? await prisma.clinic.findUnique({
          where: { id: user.clinicId },
          select: { isEnabled: true, passwordExpiryEnabled: true, singleSessionEnabled: true },
        })
      : null;

    if (user.clinicId && (!clinic || !clinic.isEnabled)) {
      return NextResponse.json(
        { error: 'This clinic has been disabled. Please contact support.' },
        { status: 403 }
      );
    }

    // Post-authentication: device fingerprint, suspicious detection, session creation, audit, flags.
    const flags = await finalizeLogin({ user, clinic, rememberMe: mfa.rememberMe, ip, userAgent });

    // Only now — after the second factor is confirmed — is the E2EE key material
    // released so the client can unwrap the master key locally.
    return NextResponse.json({
      clinicId: user.clinicId,
      wrappedKey: user.wrappedKey,
      keySalt: user.keySalt,
      publicKey: user.publicKey,
      encryptedPrivateKey: user.encryptedPrivateKey,
      privateKeyIv: user.privateKeyIv,
      ...flags,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
