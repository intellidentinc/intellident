import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAdminCaller() {
  const session = await getSession()
  if (!session) return null

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })

  if (!caller || caller.role !== 'ADMIN') return null
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

  const validRoles = ['PATIENT', 'RECEPTIONIST', 'DENTIST', 'ADMIN']
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

  return NextResponse.json(updated)
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

  return NextResponse.json({ success: true })
}
