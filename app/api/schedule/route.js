import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { safeDate } from '@/lib/validate'

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caller = await getAuthContext()
  if (!caller || caller.role !== ROLES.DENTIST) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dentist = await prisma.dentist.findUnique({
    where: { userId: session.userId },
    select: { id: true, clinicId: true },
  })
  if (!dentist || dentist.clinicId !== caller.clinicId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = safeDate(searchParams.get('from'))
  const to   = safeDate(searchParams.get('to'))

  if (!from || !to) {
    return NextResponse.json({ error: 'Valid from and to dates are required' }, { status: 400 })
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      dentistId: dentist.id,
      clinicId: caller.clinicId,
      isDeleted: false,
      scheduledAt: { gte: from, lte: to },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      service: { select: { id: true, name: true, duration: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  return NextResponse.json({ appointments })
}
