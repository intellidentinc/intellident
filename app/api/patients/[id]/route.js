import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str, sanitizeEmail } from '@/lib/validate'

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()

  if (!caller || !(caller.role === ROLES.RECEPTIONIST || isAdmin(caller.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { ip, userAgent } = getRequestMeta(request)
  const { id } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const firstName = str(parsed.body.firstName, 100)
  const lastName  = str(parsed.body.lastName, 100)
  const email     = sanitizeEmail(parsed.body.email)
  const phone     = str(parsed.body.phone, 20)

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isDeleted: true, role: true, patients: { where: { clinicId, isDeleted: false }, select: { id: true } } },
  })

  if (!target || target.isDeleted || target.role !== ROLES.PATIENT || target.patients.length !== 1) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  if (email !== undefined) {
    const emailConflict = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), id: { not: id } },
    })
    if (emailConflict) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 })
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
      },
    })

    await tx.patient.update({
      where: { id: target.patients[0].id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
      },
    })
  })

  logAudit({ userId: session.userId, clinicId, action: 'UPDATE', entity: 'Patient', entityId: id, ipAddress: ip, userAgent })

  return NextResponse.json({ success: true })
}

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()

  if (!caller || !(caller.role === ROLES.RECEPTIONIST || isAdmin(caller.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { ip: deleteIp, userAgent: deleteUa } = getRequestMeta(request)
  const { id } = await params

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isDeleted: true, role: true, patients: { where: { isDeleted: false }, select: { id: true, clinicId: true } } },
  })

  const enrollment = target?.patients.find((patient) => patient.clinicId === clinicId)
  if (!target || target.isDeleted || target.role !== ROLES.PATIENT || !enrollment) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: enrollment.id },
      data: { isDeleted: true, deletedAt: now },
    })
    if (target.patients.length === 1) {
      await tx.user.update({ where: { id }, data: { isDeleted: true, deletedAt: now } })
    }
  })

  logAudit({ userId: session.userId, clinicId, action: 'DELETE', entity: 'Patient', entityId: id, ipAddress: deleteIp, userAgent: deleteUa })

  return NextResponse.json({ success: true })
}
