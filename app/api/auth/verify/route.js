/**
 * GET /api/auth/verify?token=...
 *
 * Key features implemented here:
 *
 * 1. Single-Use Token Verification
 *    Looks up the EmailVerification record by token. Tokens expire after 24 hours
 *    and are deleted immediately after use — they cannot be replayed.
 *
 * 2. Atomic User + Patient Profile Creation (Prisma Transaction)
 *    Both the User record and the Patient profile are created in a single
 *    $transaction. If either fails, neither is persisted — no orphaned records.
 *
 * 3. Double-Click / Race Condition Guard
 *    Checks for an existing User with the same email before creating, preventing
 *    duplicate accounts if the verification link is clicked multiple times.
 *
 * 4. Auto Sign-In After Verification
 *    Sets the session immediately so the user is logged in on redirect.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!token) {
    return NextResponse.redirect(`${appUrl}/sign-in?verified=invalid`);
  }

  try {
    const pending = await prisma.emailVerification.findUnique({ where: { token } });

    if (!pending) {
      return NextResponse.redirect(`${appUrl}/sign-in?verified=invalid`);
    }

    if (new Date() > pending.expiresAt) {
      await prisma.emailVerification.delete({ where: { token } });
      return NextResponse.redirect(`${appUrl}/sign-in?verified=expired`);
    }

    // Guard: account may have been created already (double-click protection)
    const existingUser = await prisma.user.findUnique({ where: { email: pending.email } });
    if (existingUser) {
      await prisma.emailVerification.delete({ where: { token } });
      return NextResponse.redirect(`${appUrl}/sign-in?verified=already`);
    }

    // Create the account now
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: pending.email,
          password: pending.password,
          firstName: pending.firstName,
          lastName: pending.lastName,
          wrappedKey: pending.wrappedKey,
          keySalt: pending.keySalt,
          clinicId: pending.clinicId || null,
        },
      });

      if (newUser.clinicId) {
        await tx.patient.create({
          data: {
            userId: newUser.id,
            clinicId: newUser.clinicId,
            firstName: newUser.firstName || '',
            lastName: newUser.lastName || '',
          },
        });
      }

      return newUser;
    });

    // Clean up the pending record
    await prisma.emailVerification.delete({ where: { token } });

    await setSession(user.id, user.email, user.firstName, user.lastName, user.clinicId);

    return NextResponse.redirect(`${appUrl}/sign-in?verified=success`);
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(`${appUrl}/sign-in?verified=error`);
  }
}
