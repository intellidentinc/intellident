import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { parseJsonBody, sanitizeEmail } from '@/lib/validate';
import { checkRateLimit } from '@/lib/rateLimit';
import { getRequestMeta } from '@/lib/audit';

export async function POST(request) {
  try {
    const { ip } = getRequestMeta(request);
    const { allowed } = await checkRateLimit(`${ip}:forgot-password`, 5, 60 * 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const parsed = await parseJsonBody(request);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const email = sanitizeEmail(parsed.body.email);

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 to prevent email enumeration
    if (!user || user.isDeleted) {
      return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Invalidate any existing tokens for this email
    await prisma.passwordResetToken.deleteMany({ where: { email } });

    // The raw token only ever leaves in the email link; the DB stores its SHA-256
    // hash so a DB dump yields no usable reset token (cannot be reversed to the link).
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.passwordResetToken.create({ data: { token: tokenHash, email, expiresAt } });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail({ to: email, firstName: user.firstName, resetUrl });

    return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
