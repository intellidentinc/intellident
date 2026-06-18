import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { getSession, clearSession } from '@/lib/auth';
import { sendPasswordChangedEmail } from '@/lib/email';
import { parseJsonBody, secret } from '@/lib/validate';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * GET /api/auth/change-password
 *
 * Returns the authenticated user's current wrapped key material so the client can
 * re-derive the master key from the entered current password and re-wrap it under the
 * new one — without depending on the in-memory session key (which is non-extractable
 * and is lost on a page refresh). These are the same encrypted fields sign-in and
 * verify-otp already hand to the owner; useless without the password.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { wrappedKey: true, keySalt: true, isDeleted: true, isActive: true },
  });
  if (!user || user.isDeleted || !user.isActive) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  if (!user.wrappedKey || !user.keySalt) {
    return NextResponse.json({ error: 'Account setup is incomplete.' }, { status: 500 });
  }

  return NextResponse.json({ wrappedKey: user.wrappedKey, keySalt: user.keySalt });
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = await parseJsonBody(request);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { body } = parsed;

    const currentPassword = secret(body.currentPassword, 128);
    const newPassword = secret(body.newPassword, 128);
    const wrappedKey = secret(body.wrappedKey, 128);
    const keySalt = secret(body.keySalt, 64);

    if (!currentPassword || !newPassword || !wrappedKey || !keySalt) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.isDeleted || !user.isActive) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordHistory: newHistory,
        wrappedKey,
        keySalt,
        mustChangePassword: false,
        // Set a fresh expiry when the policy covers this role; clear any stale expiry otherwise.
        passwordExpiresAt: expiryEligible
          ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
          : null,
      },
    });

    await sendPasswordChangedEmail({ to: user.email, firstName: user.firstName });

    // Invalidate the current session so the client must re-authenticate
    await clearSession();

    return NextResponse.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
