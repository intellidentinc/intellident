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
import { setSession } from '@/lib/auth';
import { getRequestMeta, logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rateLimit';

const MAX_OTP_ATTEMPTS = 5;

export async function POST(request) {
  try {
    const { ip, userAgent } = getRequestMeta(request);

    const { allowed } = await checkRateLimit(`${ip}:verify-otp`, 15, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const { pendingToken, code } = body;

    if (!pendingToken || !code) {
      return NextResponse.json({ error: 'Missing token or code' }, { status: 400 });
    }

    const mfa = await prisma.mfaOtp.findUnique({
      where: { pendingToken },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, clinicId: true, role: true } } },
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
    await setSession(user.id, user.email, user.firstName, user.lastName, user.clinicId, mfa.rememberMe, false, false, null, null, user.role);

    logAudit({ userId: user.id, clinicId: user.clinicId, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: ip, userAgent });

    return NextResponse.json({ clinicId: user.clinicId });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
