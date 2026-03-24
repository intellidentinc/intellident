import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendPasswordChangedEmail } from '@/lib/email';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword, wrappedKey, keySalt } = await request.json();

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
    if (!user || user.isDeleted) {
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

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, passwordHistory: newHistory, wrappedKey, keySalt },
    });

    await sendPasswordChangedEmail({ to: user.email, firstName: user.firstName });

    return NextResponse.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
