import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getSession, grantStepUp, isStepUpValid } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseJsonBody, secret, hexToken } from '@/lib/validate';
import { getRequestMeta, logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rateLimit';

const MAX_OTP_ATTEMPTS = 5;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ valid: false }, { status: 401 });
  return NextResponse.json({ valid: isStepUpValid(session) });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody(request);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const { ip, userAgent } = getRequestMeta(request);
  const { body } = parsed;

  // ── OTP mode (record access) ─────────────────────────────────────────────
  if (body.pendingToken !== undefined || body.code !== undefined) {
    const { allowed } = await checkRateLimit(`${ip}:step-up-verify`, 15, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const pendingToken = hexToken(body.pendingToken);
    const code         = secret(body.code, 16);

    if (!pendingToken || !code) {
      return NextResponse.json({ error: 'Verification code and token are required' }, { status: 400 });
    }

    const mfa = await prisma.mfaOtp.findUnique({ where: { pendingToken } });

    if (!mfa || mfa.userId !== session.userId) {
      return NextResponse.json({ error: 'Invalid or expired code. Please request a new one.' }, { status: 400 });
    }
    if (mfa.usedAt) {
      return NextResponse.json({ error: 'This code has already been used. Please request a new one.' }, { status: 400 });
    }
    if (mfa.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Code has expired. Please request a new one.' }, { status: 400 });
    }
    if (mfa.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
    }

    const isValid = await bcrypt.compare(String(code).trim(), mfa.codeHash);

    if (!isValid) {
      const newAttempts = mfa.attempts + 1;
      await prisma.mfaOtp.update({ where: { id: mfa.id }, data: { attempts: newAttempts } });
      const remaining = MAX_OTP_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
      }
      return NextResponse.json({ error: `Incorrect code. ${remaining} attempt(s) remaining.` }, { status: 401 });
    }

    await prisma.mfaOtp.update({ where: { id: mfa.id }, data: { usedAt: new Date() } });

    logAudit({
      userId: session.userId,
      clinicId: session.clinicId,
      action: 'VERIFY',
      entity: 'StepUp',
      ipAddress: ip,
      userAgent,
      metadata: { mode: 'otp', success: true },
    });

    const granted = await grantStepUp();
    if (!granted) {
      return NextResponse.json({ error: 'Session error — please sign in again' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── Password mode (export / backup / step-up page) ───────────────────────
  const { allowed } = await checkRateLimit(`${ip}:step-up-password`, 10, 15 * 60);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const password = secret(body.password, 128);
  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { password: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  logAudit({
    userId: session.userId,
    clinicId: session.clinicId,
    action: 'VERIFY',
    entity: 'StepUp',
    ipAddress: ip,
    userAgent,
    metadata: { mode: 'password', success: true },
  });

  const granted = await grantStepUp();
  if (!granted) {
    return NextResponse.json({ error: 'Session error — please sign in again' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
