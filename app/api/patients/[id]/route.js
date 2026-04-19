import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })

  if (!caller || caller.role !== ROLES.RECEPTIONIST) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ip, userAgent } = getRequestMeta(request)
  const { id } = await params
  const { firstName, lastName, email, phone } = await request.json()

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, clinicId: true, isDeleted: true, role: true },
  })

  if (!target || target.isDeleted || target.clinicId !== caller.clinicId || target.role !== 'PATIENT') {
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

    await tx.patient.updateMany({
      where: { userId: id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
      },
    })
  })

  logAudit({ userId: session.userId, clinicId: caller.clinicId, action: 'UPDATE', entity: 'Patient', entityId: id, ipAddress: ip, userAgent })

  return NextResponse.json({ success: true })
}

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })

  if (!caller || caller.role !== ROLES.RECEPTIONIST) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ip: deleteIp, userAgent: deleteUa } = getRequestMeta(request)
  const { id } = await params

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, clinicId: true, isDeleted: true, role: true },
  })

  if (!target || target.isDeleted || target.clinicId !== caller.clinicId || target.role !== 'PATIENT') {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { isDeleted: true, deletedAt: now },
    })

    await tx.patient.updateMany({
      where: { userId: id },
      data: { isDeleted: true, deletedAt: now },
    })
  })

  logAudit({ userId: session.userId, clinicId: caller.clinicId, action: 'DELETE', entity: 'Patient', entityId: id, ipAddress: deleteIp, userAgent: deleteUa })

  return NextResponse.json({ success: true })
}
