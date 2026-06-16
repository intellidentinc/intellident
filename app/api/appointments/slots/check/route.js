import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caller = await getAuthContext()
  if (!caller || ![ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.SUPERADMIN].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { searchParams } = new URL(request.url)
  const dentistId            = searchParams.get('dentistId')
  const scheduledAtStr       = searchParams.get('scheduledAt')
  const serviceIdsParam      = searchParams.get('serviceIds') ?? searchParams.get('serviceId')
  const excludeAppointmentId = searchParams.get('excludeAppointmentId')

  if (!dentistId || !scheduledAtStr || !serviceIdsParam) {
    return NextResponse.json({ available: true })
  }

  const serviceIds = serviceIdsParam.split(',').filter(Boolean)

  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, clinicId, isDeleted: false },
  })
  if (services.length === 0) return NextResponse.json({ available: true })

  const totalDuration = services.reduce((sum, s) => sum + s.duration + s.bufferTime, 0)
  const scheduledAt = new Date(scheduledAtStr)
  const endsAt = new Date(scheduledAt.getTime() + totalDuration * 60 * 1000)

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
