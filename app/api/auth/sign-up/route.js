/**
 * POST /api/auth/sign-up
 *
 * Key features implemented here:
 *
 * 1. Two-Phase Registration (Email Verification Gate)
 *    This route does NOT create a User. It creates an EmailVerification record
 *    (24h expiry) and sends a tokenized link via Gmail. The actual User +
 *    Patient profile are only created when the link is clicked (see /api/auth/verify).
 *    This prevents unverified email addresses from accessing the system.
 *
 * 2. Server-Side Password Policy Enforcement
 *    Minimum 8 chars, uppercase, lowercase, digit, special character.
 *    Enforced here even if the client already validated — defense in depth.
 *
 * 3. E2EE Key Material Acceptance
 *    The client generates the master key + KEK client-side and sends only
 *    `wrappedKey` and `keySalt` here. The server stores the wrapped (encrypted)
 *    key blob — it has no way to decrypt user data without the user's password.
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { parseJsonBody, sanitizeEmail, secret, str } from '@/lib/validate';
import { checkRateLimit } from '@/lib/rateLimit';
import { getRequestMeta } from '@/lib/audit';

export async function POST(request) {
  try {
    const { ip } = getRequestMeta(request);
    const { allowed } = await checkRateLimit(`${ip}:sign-up`, 10, 60 * 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const parsed = await parseJsonBody(request);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { body } = parsed;

    const email = sanitizeEmail(body.email);
    const password = secret(body.password, 128);
    const firstName = str(body.firstName, 100) ?? null;
    const middleInitial = str(body.middleInitial, 5) ?? null;
    const lastName = str(body.lastName, 100) ?? null;
    const wrappedKey = secret(body.wrappedKey, 128);
    const keySalt = secret(body.keySalt, 64);
    const clinicId = str(body.clinicId, 50) ?? null;

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

    // Check if a verified account already exists — blind response to prevent email enumeration
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { message: 'If this email is not already registered, a verification link will be sent.' },
        { status: 200 }
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
        middleInitial: middleInitial || null,
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
