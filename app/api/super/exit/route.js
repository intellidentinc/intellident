import { NextResponse } from 'next/server'
import { getSession, setSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  if (!user || user.role !== ROLES.SUPERADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Restore session to super admin state — no clinicId, no superAdmin flag
  await setSession(session.userId, session.email, session.firstName, session.lastName, null, session.rememberMe)

  return NextResponse.json({ ok: true })
}
