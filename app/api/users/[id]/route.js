import { NextResponse } from 'next/server'
import { getSession, clearSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, ROLE_LABELS } from '@/lib/roles'

async function getAdminCaller() {
  const session = await getSession()
  if (!session) return null

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })

  if (!caller || caller.role !== ROLES.ADMIN) return null
  return caller
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

  const { id } = await params
  const { role } = await request.json()

  const validRoles = Object.values(ROLES)
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const target = await getTargetUser(id, caller.clinicId)
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, role: true }
  })

  const session = await getSession()
  const isSelf = session?.userId === id
  if (isSelf) await clearSession()

  return NextResponse.json({ ...updated, loggedOut: isSelf })
}

export async function DELETE(request, { params }) {
  const caller = await getAdminCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  return NextResponse.json({ success: true, loggedOut: isSelf })
}
