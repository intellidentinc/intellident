import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendPasswordChangedEmail } from '@/lib/email';
import { parseJsonBody, hexToken, secret } from '@/lib/validate';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export async function POST(request) {
  try {
    const parsed = await parseJsonBody(request);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { body } = parsed;

    const token = hexToken(body.token);
    const newPassword = secret(body.newPassword, 128);
    const wrappedKey = secret(body.wrappedKey, 128);
    const keySalt = secret(body.keySalt, 64);

    if (!token || !newPassword || !wrappedKey || !keySalt) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.' },
        { status: 400 }
      );
    }

    // Tokens are stored hashed; hash the incoming raw token to look it up.
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Reset link is invalid or has expired.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: resetToken.email } });
    if (!user || user.isDeleted) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Check against previous 3 passwords
    const history = [user.password, ...user.passwordHistory];
    for (const oldHash of history) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        return NextResponse.json(
          { error: 'Password cannot match any of your last 3 passwords.' },
          { status: 400 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const newHistory = [user.password, ...user.passwordHistory].slice(0, 3);

    // Recompute password expiry per the clinic policy — mirrors change-password so a reset
    // sets a fresh expiry (or clears a stale one) instead of leaving an old/expired value
    // that would immediately bounce the user to /change-password?reason=expired.
    let clinic = null;
    if (user.clinicId) {
      clinic = await prisma.clinic.findUnique({
        where: { id: user.clinicId },
        select: { passwordExpiryEnabled: true, passwordExpiryDays: true, passwordExpiryRoles: true },
      });
    }
    const expiryEligible =
      clinic?.passwordExpiryEnabled === true &&
      Array.isArray(clinic.passwordExpiryRoles) &&
      clinic.passwordExpiryRoles.includes(user.role);
    const expiryDays = clinic?.passwordExpiryDays ?? 90;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        // A reset mints a fresh master key, so the old envelope keypair (its private key
        // was encrypted under the now-lost master key) is unrecoverable. Clear it; a fresh
        // keypair is provisioned on next login and record access auto-heals via reshare.
        data: {
          password: hashedPassword,
          passwordHistory: newHistory,
          wrappedKey,
          keySalt,
          publicKey: null,
          encryptedPrivateKey: null,
          privateKeyIv: null,
          passwordExpiresAt: expiryEligible
            ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
            : null,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await sendPasswordChangedEmail({ to: user.email, firstName: user.firstName });

    return NextResponse.json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
