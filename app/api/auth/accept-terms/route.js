import { NextResponse } from 'next/server'
import { getSession, setSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.user.update({
    where: { id: session.userId },
    data: { termsAcceptedAt: new Date() },
  })

  // Re-issue session with requiresTerms cleared, preserving the suspicious-session
  // and forced password-change flags so accepting terms can't skip those gates.
  await setSession(
    session.userId,
    session.email,
    session.firstName,
    session.lastName,
    session.clinicId,
    session.rememberMe,
    session.superAdmin || false,
    false,
    null, null,
    session.role ?? null,
    session.suspiciousSession || false,
    session.mustChangePassword || false,
  )

  return NextResponse.json({ success: true })
}
