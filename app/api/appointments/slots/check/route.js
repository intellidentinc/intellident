import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!caller || !['RECEPTIONIST', 'ADMIN'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dentistId           = searchParams.get('dentistId')
  const scheduledAtStr      = searchParams.get('scheduledAt')
  const serviceId           = searchParams.get('serviceId')
  const excludeAppointmentId = searchParams.get('excludeAppointmentId')

  if (!dentistId || !scheduledAtStr || !serviceId) {
    return NextResponse.json({ available: true })
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, clinicId: caller.clinicId, isDeleted: false },
  })
  if (!service) return NextResponse.json({ available: true })

  const scheduledAt = new Date(scheduledAtStr)
  const endsAt = new Date(scheduledAt.getTime() + (service.duration + service.bufferTime) * 60 * 1000)

  const conflict = await prisma.appointment.findFirst({
    where: {
      dentistId,
      isDeleted: false,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      scheduledAt: { lt: endsAt },
      endsAt:      { gt: scheduledAt },
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
    },
  })

  if (conflict) {
    return NextResponse.json({
      available: false,
      conflict: {
        patientName: conflict.patient ? `${conflict.patient.firstName} ${conflict.patient.lastName}` : null,
        scheduledAt: conflict.scheduledAt,
      },
    })
  }

  return NextResponse.json({ available: true })
}
