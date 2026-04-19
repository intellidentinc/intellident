import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

async function getAdminForClinic(clinicId) {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })
  if (!caller || caller.role !== ROLES.ADMIN || caller.clinicId !== clinicId) return null
  return caller
}

export async function GET(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const closures = await prisma.clinicClosure.findMany({
    where: { clinicId: id },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, reason: true }
  })

  return NextResponse.json(closures)
}

export async function POST(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { date, reason } = await request.json()

  if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })

  const parsed = new Date(date)
  if (isNaN(parsed.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const closure = await prisma.clinicClosure.create({
    data: { clinicId: id, date: parsed, reason: reason?.trim() || null },
    select: { id: true, date: true, reason: true }
  })

  return NextResponse.json(closure)
}
