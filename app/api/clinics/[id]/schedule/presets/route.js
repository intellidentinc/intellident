import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'

const VALID_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

async function getAdminForClinic(clinicId) {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })
  if (!caller || !isAdmin(caller.role)) return null
  const effectiveClinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  if (effectiveClinicId !== clinicId) return null
  return caller
}

export async function GET(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const presets = await prisma.schedulePreset.findMany({
    where: { clinicId: id, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, workingDays: true, openTime: true, closeTime: true }
  })

  return NextResponse.json(presets)
}

export async function POST(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, workingDays, openTime, closeTime } = await request.json()

  if (!name?.trim()) return NextResponse.json({ error: 'Preset name is required' }, { status: 400 })
  if (!Array.isArray(workingDays) || workingDays.some((d) => !VALID_DAYS.includes(d))) {
    return NextResponse.json({ error: 'Invalid working days' }, { status: 400 })
  }
  if (!TIME_REGEX.test(openTime) || !TIME_REGEX.test(closeTime)) {
    return NextResponse.json({ error: 'Invalid time format' }, { status: 400 })
  }
  if (openTime >= closeTime) {
    return NextResponse.json({ error: 'Opening time must be before closing time' }, { status: 400 })
  }

  const preset = await prisma.schedulePreset.create({
    data: { clinicId: id, name: name.trim(), workingDays, openTime, closeTime },
    select: { id: true, name: true, workingDays: true, openTime: true, closeTime: true }
  })

  return NextResponse.json(preset)
}
