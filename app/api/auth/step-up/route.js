import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { consumeOtp } from '@/lib/otp';
import { getSession, grantStepUp, isStepUpValid } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseJsonBody, secret, hexToken } from '@/lib/validate';
import { getRequestMeta, logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rateLimit';


export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ valid: false }, { status: 401 });
  return NextResponse.json({ valid: isStepUpValid(session, 'password') });
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

    const result = await consumeOtp({
      pendingToken, code: code.trim(), purpose: 'step-up', scope: session.sessionToken, userId: session.userId,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

    logAudit({
      userId: session.userId,
      clinicId: session.clinicId,
      action: 'VERIFY',
      entity: 'StepUp',
      ipAddress: ip,
      userAgent,
      metadata: { mode: 'otp', success: true },
    });

    const granted = await grantStepUp('otp');
    if (!granted) {
      return NextResponse.json({ error: 'Session error — please sign in again' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── Password mode (export / backup / step-up page) ───────────────────────
  // Keep the account budget stable across IP changes and session rotation.
  const accountLimit = await checkRateLimit(`step-up-password:user:${session.userId}`, 5, 15 * 60);
  if (!accountLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }
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
