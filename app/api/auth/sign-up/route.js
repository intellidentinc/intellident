import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request) {
  try {
    const { email, password, firstName, lastName, wrappedKey, keySalt, clinicId } = await request.json();

    if (!email || !password || !clinicId) {
      return NextResponse.json(
        { error: 'Email, password, and clinic are required' },
        { status: 400 }
      );
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.' },
        { status: 400 }
      );
    }

    if (!wrappedKey || !keySalt) {
      return NextResponse.json(
        { error: 'Encryption key material is required' },
        { status: 400 }
      );
    }

    // Check if a verified account already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Replace any previous pending verification for this email
    await prisma.emailVerification.deleteMany({ where: { email } });
    await prisma.emailVerification.create({
      data: {
        token,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        password: hashedPassword,
        wrappedKey,
        keySalt,
        clinicId: clinicId || null,
        expiresAt,
      },
    });

    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify?token=${token}`;

    await sendVerificationEmail({ to: email, firstName, verificationUrl });

    return NextResponse.json(
      { message: 'Verification email sent. Please check your inbox.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
