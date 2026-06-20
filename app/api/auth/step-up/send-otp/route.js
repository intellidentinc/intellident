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

  // Await delivery — on serverless the function can be frozen right after the
  // response returns, dropping any un-awaited email send. Mirror the sign-in
  // MFA path (which awaits sendMfaOtpEmail) so the code reliably goes out.
  try {
    await sendStepUpOtpEmail({ to: user.email, firstName: user.firstName, code: otp });
  } catch (err) {
    console.error('step-up send-otp email failed', err);
    return NextResponse.json(
      { error: 'Failed to send verification code. Please try again.' },
      { status: 502 },
    );
  }

  await prisma.mfaOtp.create({
    data: { userId: session.userId, pendingToken, codeHash, rememberMe: false, expiresAt },
  });

  return NextResponse.json({ pendingToken });
}
