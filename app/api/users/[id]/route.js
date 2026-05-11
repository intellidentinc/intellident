import { NextResponse } from 'next/server'
import { getSession, clearSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, ROLE_LABELS, isAdmin } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody } from '@/lib/validate'

async function getAdminCaller() {
  const session = await getSession()
  if (!session) return null

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })

  if (!caller || !isAdmin(caller.role)) return null
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  return { ...caller, clinicId, id: session.userId }
}

async function getTargetUser(id, clinicId) {
  const target = await prisma.user.findUnique({
    where: { id },
    select: { clinicId: true, isDeleted: true }
  })

  if (!target || target.isDeleted || target.clinicId !== clinicId) return null
  return target
}

export async function PATCH(request, { params }) {
  const caller = await getAdminCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const { id } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  const target = await getTargetUser(id, caller.clinicId)
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Toggle active status
  if (typeof body.isActive === 'boolean') {
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: body.isActive },
      select: { id: true, isActive: true }
    })

    const session = await getSession()
    const isSelf = session?.userId === id
    if (isSelf && !body.isActive) await clearSession()

    logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'UPDATE', entity: 'User', entityId: id, ipAddress: ip, userAgent, metadata: { isActive: body.isActive } })

    return NextResponse.json({ ...updated, loggedOut: isSelf && !body.isActive })
  }

  // Role update — only clinic-assignable roles permitted; ADMIN and SUPERADMIN cannot be granted via this endpoint
  const { role } = body
  const assignableRoles = [ROLES.DENTIST, ROLES.RECEPTIONIST, ROLES.PATIENT]
  if (!assignableRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, role: true }
  })

  const session = await getSession()
  const isSelf = session?.userId === id
  if (isSelf) await clearSession()

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'UPDATE', entity: 'User', entityId: id, ipAddress: ip, userAgent, metadata: { newRole: role } })

  return NextResponse.json({ ...updated, loggedOut: isSelf })
}

export async function DELETE(request, { params }) {
  const caller = await getAdminCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const { id } = await params

  const target = await getTargetUser(id, caller.clinicId)
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.user.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() }
  })

  const session = await getSession()
  const isSelf = session?.userId === id
  if (isSelf) await clearSession()

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'DELETE', entity: 'User', entityId: id, ipAddress: ip, userAgent })

  return NextResponse.json({ success: true, loggedOut: isSelf })
}
