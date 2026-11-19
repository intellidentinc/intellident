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
    if (!user || user.isDeleted || !user.isActive) {
      return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Validate the configured destination before issuing a token. Never derive it
    // from request headers, which could send users to an attacker-controlled host.
    const resetUrl = new URL('/reset-password', process.env.NEXT_PUBLIC_APP_URL);
    if (!['https:', 'http:'].includes(resetUrl.protocol) || resetUrl.username || resetUrl.password) {
      throw new Error('Invalid application URL');
    }

    // Retain unexpired links until a successful reset revokes them all. A failed
    // resend must not invalidate a link that has already reached the user's inbox.
    await prisma.passwordResetToken.deleteMany({ where: { email, expiresAt: { lte: new Date() } } });

    // The raw token only ever leaves in the email link; the DB stores its SHA-256
    // hash so a DB dump yields no usable reset token (cannot be reversed to the link).
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.passwordResetToken.create({ data: { token: tokenHash, email, expiresAt } });

    resetUrl.searchParams.set('token', token);
    try {
      await sendPasswordResetEmail({ to: email, firstName: user.firstName, resetUrl: resetUrl.toString() });
    } catch (error) {
      // Remove only the challenge belonging to this failed delivery.
      await prisma.passwordResetToken.deleteMany({ where: { token: tokenHash, usedAt: null } });
      console.error('Password reset email failed', { code: error.code || 'EMAIL_SEND' });
      return NextResponse.json({ error: 'Unable to send the password reset email. Please try again later or contact your clinic.' }, { status: 502 });
    }

    return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error', { code: error.code || 'RESET_REQUEST_FAILED' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
