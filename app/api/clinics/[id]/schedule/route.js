import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { parseJsonBody } from '@/lib/validate'

const VALID_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

async function getAdminForClinic(clinicId) {
  const session = await getSession()
  if (!session) return null
  const caller = await getAuthContext()
  if (!caller || !isAdmin(caller.role)) return null
  const effectiveClinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  if (effectiveClinicId !== clinicId) return null
  return caller
}

export async function GET(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schedule = await prisma.clinicSchedule.findUnique({ where: { clinicId: id } })

  return NextResponse.json(
    schedule ?? { workingDays: [], openTime: '08:00', closeTime: '17:00' }
  )
}

export async function PATCH(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { workingDays, openTime, closeTime } = parsed.body

  if (!Array.isArray(workingDays) || workingDays.some((d) => !VALID_DAYS.includes(d))) {
    return NextResponse.json({ error: 'Invalid working days' }, { status: 400 })
  }
  if (!TIME_REGEX.test(openTime) || !TIME_REGEX.test(closeTime)) {
    return NextResponse.json({ error: 'Invalid time format' }, { status: 400 })
  }
  if (openTime >= closeTime) {
    return NextResponse.json({ error: 'Opening time must be before closing time' }, { status: 400 })
  }

  const schedule = await prisma.clinicSchedule.upsert({
    where: { clinicId: id },
    create: { clinicId: id, workingDays, openTime, closeTime },
    update: { workingDays, openTime, closeTime }
  })

  return NextResponse.json(schedule)
}
