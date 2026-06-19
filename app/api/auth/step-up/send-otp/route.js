import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendStepUpOtpEmail } from '@/lib/email';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { allowed } = await checkRateLimit(`step-up-send:${session.userId}`, 5, 15 * 60);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait before requesting another code.' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, firstName: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const otp          = String(crypto.randomInt(100000, 1000000));
  const pendingToken = crypto.randomBytes(32).toString('hex');
  const codeHash     = await bcrypt.hash(otp, 8);
  const expiresAt    = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.mfaOtp.create({
    data: { userId: session.userId, pendingToken, codeHash, rememberMe: false, expiresAt },
  });

  // Fire-and-forget — don't block the response on email delivery
  sendStepUpOtpEmail({ to: user.email, firstName: user.firstName, code: otp }).catch(() => {});

  return NextResponse.json({ pendingToken });
}
