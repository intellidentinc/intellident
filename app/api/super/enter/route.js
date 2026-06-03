import { NextResponse } from 'next/server'
import { getSession, setSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { logAudit, getRequestMeta } from '@/lib/audit'
import { parseJsonBody } from '@/lib/validate'

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  if (!user || user.role !== ROLES.SUPERADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { clinicId } = parsed.body
  if (!clinicId) return NextResponse.json({ error: 'clinicId is required' }, { status: 400 })

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId, isDeleted: false } })
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  // Set session with chosen clinicId + superAdmin flag so layout allows entry
  await setSession(session.userId, session.email, session.firstName, session.lastName, clinicId, false, true, false, null, null, ROLES.SUPERADMIN)

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId, action: 'VIEW', entity: 'Clinic', entityId: clinicId, ipAddress: ip, userAgent, metadata: { action: 'superadmin-enter' } })

  return NextResponse.json({ clinicId })
}
