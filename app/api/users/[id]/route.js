import { NextResponse } from 'next/server'
import { getSession, clearSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, ROLE_LABELS, isAdmin } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody } from '@/lib/validate'
import { reconcileRoleProfile } from '@/lib/userProfiles'

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
    select: { clinicId: true, isDeleted: true, firstName: true, lastName: true, role: true }
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

  // Role update — staff-only swaps. Patients (customers) and admins are not
  // reassignable here; staff are created via Add User. Both the new role and the
  // target's current role must be DENTIST or RECEPTIONIST.
  const staffRoles = [ROLES.DENTIST, ROLES.RECEPTIONIST]
  const role = Number(body.role)
  if (!staffRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (!staffRoles.includes(target.role)) {
    return NextResponse.json({ error: 'Only dentist and receptionist roles can be reassigned. Create staff via Add User.' }, { status: 400 })
  }

  const clinicId = caller.clinicId

  let updated
  try {
    updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { role },
        select: { id: true, role: true }
      })

      await reconcileRoleProfile(tx, {
        userId: id,
        role,
        clinicId,
        firstName: target.firstName,
        lastName: target.lastName,
      })

      return user
    })
  } catch (err) {
    console.error('Role update failed:', err)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

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

  const now = new Date()

  // Soft-delete the user AND cascade to its linked profile record so counts that
  // query the profile tables (e.g. dashboard "Total patients") stay consistent.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { isDeleted: true, deletedAt: now },
    })
    await tx.patient.updateMany({ where: { userId: id, isDeleted: false }, data: { isDeleted: true, deletedAt: now } })
    await tx.dentist.updateMany({ where: { userId: id, isDeleted: false }, data: { isDeleted: true, deletedAt: now } })
    await tx.receptionist.updateMany({ where: { userId: id, isDeleted: false }, data: { isDeleted: true, deletedAt: now } })
  })

  const session = await getSession()
  const isSelf = session?.userId === id
  if (isSelf) await clearSession()

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'DELETE', entity: 'User', entityId: id, ipAddress: ip, userAgent })

  return NextResponse.json({ success: true, loggedOut: isSelf })
}
