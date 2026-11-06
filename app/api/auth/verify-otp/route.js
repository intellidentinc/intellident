/**
 * POST /api/auth/verify-otp
 *
 * Validates the 6-digit OTP issued during sign-in (MFA step 2).
 * On success: creates session and returns clinicId so client can redirect.
 * On failure: increments attempt counter; invalidates after 5 failed attempts.
 */
import { NextResponse } from 'next/server';
import { consumeOtp } from '@/lib/otp';
import { prisma } from '@/lib/prisma';
import { finalizeLogin } from '@/lib/login';
import { getRequestMeta } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rateLimit';
import { parseJsonBody, hexToken, secret } from '@/lib/validate';


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

    const result = await consumeOtp({ pendingToken, code: code.trim(), purpose: 'login' });
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
    const mfa = result.challenge;

    const { user } = mfa;

    // Load clinic config + re-check it is still enabled (defense-in-depth between the two steps).
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
