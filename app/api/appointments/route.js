import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyPatientStatusChange } from '@/lib/notifications'

async function getCaller() {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true, id: true },
  })
  if (!caller || !['RECEPTIONIST', 'ADMIN'].includes(caller.role)) return null
  return caller
}

export async function GET(request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page      = parseInt(searchParams.get('page') ?? '0', 10)
  const pageSize  = parseInt(searchParams.get('pageSize') ?? '10', 10)
  const sortField = searchParams.get('sortField') ?? 'scheduledAt'
  const sortOrder = searchParams.get('sortOrder') ?? 'desc'
  const status    = searchParams.get('status')
  const dentistId = searchParams.get('dentistId')
  const serviceId = searchParams.get('serviceId')
  const search    = searchParams.get('search')?.trim()

  const VALID_SORT = ['scheduledAt', 'createdAt']
  const field = VALID_SORT.includes(sortField) ? sortField : 'scheduledAt'
  const order = sortOrder === 'asc' ? 'asc' : 'desc'

  const where = {
    clinicId: caller.clinicId,
    isDeleted: false,
    ...(status    ? { status }              : {}),
    ...(dentistId ? { dentistId }           : {}),
    ...(serviceId ? { serviceId }           : {}),
    ...(search
      ? {
          OR: [
            { appointmentCode: { contains: search, mode: 'insensitive' } },
            { patient: { firstName: { contains: search, mode: 'insensitive' } } },
            { patient: { lastName:  { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        service: { select: { id: true, name: true, duration: true } },
      },
      orderBy: { [field]: order },
      skip: page * pageSize,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ])

  return NextResponse.json({ appointments, total })
}

export async function POST(request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, serviceId, dentistId, scheduledAt, notes, status } = await request.json()

  if (!patientId || !serviceId || !scheduledAt) {
    return NextResponse.json({ error: 'patientId, serviceId, and scheduledAt are required' }, { status: 400 })
  }

  // Fetch service for duration/buffer
  const service = await prisma.service.findFirst({
    where: { id: serviceId, clinicId: caller.clinicId, isDeleted: false },
  })
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

  // Fetch clinic schedule + closures
  const [schedule, closures, clinic] = await Promise.all([
    prisma.clinicSchedule.findUnique({ where: { clinicId: caller.clinicId } }),
    prisma.clinicClosure.findMany({ where: { clinicId: caller.clinicId } }),
    prisma.clinic.findUnique({ where: { id: caller.clinicId }, select: { code: true } }),
  ])

  const apptDate = new Date(scheduledAt)

  // Validate working day
  if (schedule?.workingDays?.length) {
    const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const dayName = DAY_NAMES[apptDate.getDay()]
    if (!schedule.workingDays.includes(dayName)) {
      return NextResponse.json({ error: `${dayName} is not a working day` }, { status: 400 })
    }
  }

  // Validate not a closure
  const dateStr = apptDate.toISOString().slice(0, 10)
  const isClosure = closures.some((c) => new Date(c.date).toISOString().slice(0, 10) === dateStr)
  if (isClosure) {
    return NextResponse.json({ error: 'This date is a clinic closure' }, { status: 400 })
  }

  // Validate operating hours
  if (schedule) {
    const [openH, openM]   = schedule.openTime.split(':').map(Number)
    const [closeH, closeM] = schedule.closeTime.split(':').map(Number)
    const apptMinutes = apptDate.getHours() * 60 + apptDate.getMinutes()
    const openMinutes  = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM
    if (apptMinutes < openMinutes || apptMinutes >= closeMinutes) {
      return NextResponse.json({ error: `Appointment must be between ${schedule.openTime} and ${schedule.closeTime}` }, { status: 400 })
    }
  }

  const endsAt = new Date(apptDate.getTime() + (service.duration + service.bufferTime) * 60 * 1000)

  // Dentist conflict check (only if specific dentist chosen)
  if (dentistId) {
    const overlap = await prisma.appointment.findFirst({
      where: {
        dentistId,
        isDeleted: false,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [
          { scheduledAt: { lt: endsAt }, endsAt: { gt: apptDate } },
        ],
      },
    })
    if (overlap) {
      return NextResponse.json({ error: 'This dentist has a conflicting appointment at that time' }, { status: 409 })
    }
  }

  // Generate appointmentCode: APT-{CLINICCODE}-{YYYY/MM/DD}-{####}
  const clinicCode = clinic?.code ?? 'CLN'
  const datePart = `${apptDate.getFullYear()}/${String(apptDate.getMonth() + 1).padStart(2, '0')}/${String(apptDate.getDate()).padStart(2, '0')}`
  const existingCount = await prisma.appointment.count({
    where: {
      clinicId: caller.clinicId,
      scheduledAt: {
        gte: new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate()),
        lt:  new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate() + 1),
      },
    },
  })
  const appointmentCode = `APT-${clinicCode}-${datePart}-${String(existingCount + 1).padStart(4, '0')}`

  const initialStatus = ['PENDING', 'CONFIRMED'].includes(status) ? status : 'PENDING'

  const appointment = await prisma.appointment.create({
    data: {
      clinicId: caller.clinicId,
      patientId,
      serviceId,
      dentistId: dentistId || null,
      scheduledAt: apptDate,
      endsAt,
      status: initialStatus,
      notes: notes || null,
      appointmentCode,
      statusHistory: {
        create: {
          status: initialStatus,
          changedById: caller.id,
        },
      },
    },
    include: {
      patient: {
        include: { user: { select: { id: true, email: true, firstName: true } } },
      },
      service: { select: { name: true } },
    },
  })

  // If created directly as CONFIRMED, notify the patient
  if (initialStatus === 'CONFIRMED') {
    const patientUser = appointment.patient?.user
    if (patientUser?.id) {
      await notifyPatientStatusChange({
        userId: patientUser.id,
        clinicId: caller.clinicId,
        appointmentId: appointment.id,
        status: 'CONFIRMED',
        patientEmail: patientUser.email,
        patientFirstName: patientUser.firstName,
        serviceName: appointment.service?.name ?? 'your appointment',
        scheduledAt: apptDate,
        appointmentCode,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ appointment }, { status: 201 })
}
