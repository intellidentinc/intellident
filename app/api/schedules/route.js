/**
 * /api/schedules — PATIENT role only
 *
 * Key features implemented here:
 *
 * GET  — Returns the patient's own appointments split into 'upcoming' and 'past' tabs.
 *         Upcoming: PENDING | CONFIRMED | RESCHEDULED with scheduledAt ≥ now
 *         Past:     COMPLETED | CANCELLED | NO_SHOW, or any with scheduledAt < now
 *
 * POST — Patient self-booking. Always creates the appointment as PENDING.
 *   - Zero trust: getPatientCaller() verifies patient.clinicId === user.clinicId
 *   - Runs the same 5-step validation as the receptionist route (working day,
 *     closure, operating hours, dentist ownership, dentist conflict)
 *   - Operating hours are validated in PHT (Asia/Manila timezone) via dayjs-timezone
 *   - Generates the appointmentCode the same way as the receptionist route
 *   - On success, notifies all RECEPTIONIST + ADMIN users (in-app + email)
 *     via notifyStaffBooking — the pending badge in the sidebar increments
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyStaffBooking } from '@/lib/notifications'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

async function getPatientCaller() {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!user || user.role !== ROLES.PATIENT) return null
  const patient = await prisma.patient.findUnique({
    where: { userId: session.userId },
  })
  // Tenant check: patient profile must belong to the same clinic as the user account
  if (!patient || patient.clinicId !== user.clinicId) return null
  return { ...user, patientId: patient.id, userId: session.userId }
}

export async function GET(request) {
  const caller = await getPatientCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') ?? 'upcoming'
  const now = new Date()

  const where = {
    patientId: caller.patientId,
    isDeleted: false,
    ...(tab === 'upcoming'
      ? {
          status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
          scheduledAt: { gte: now },
        }
      : {
          OR: [
            { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } },
            { scheduledAt: { lt: now } },
          ],
        }),
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      service: { select: { name: true, duration: true } },
      dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { scheduledAt: tab === 'upcoming' ? 'asc' : 'desc' },
  })

  return NextResponse.json({ appointments })
}

export async function POST(request) {
  const caller = await getPatientCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const { serviceId, dentistId, scheduledAt, notes } = await request.json()

  if (!serviceId || !scheduledAt) {
    return NextResponse.json({ error: 'serviceId and scheduledAt are required' }, { status: 400 })
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, clinicId: caller.clinicId, isDeleted: false },
  })
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

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
  if (closures.some(c => new Date(c.date).toISOString().slice(0, 10) === dateStr)) {
    return NextResponse.json({ error: 'This date is a clinic closure' }, { status: 400 })
  }

  // Validate operating hours (PHT = Asia/Manila)
  if (schedule) {
    const [openH, openM]   = schedule.openTime.split(':').map(Number)
    const [closeH, closeM] = schedule.closeTime.split(':').map(Number)
    const apptPHT  = dayjs(apptDate).tz('Asia/Manila')
    const apptMin  = apptPHT.hour() * 60 + apptPHT.minute()
    const openMin  = openH * 60 + openM
    const closeMin = closeH * 60 + closeM
    if (apptMin < openMin || apptMin >= closeMin) {
      return NextResponse.json({ error: `Appointment must be between ${schedule.openTime} and ${schedule.closeTime}` }, { status: 400 })
    }
  }

  const endsAt = new Date(apptDate.getTime() + (service.duration + service.bufferTime) * 60 * 1000)

  // Verify dentistId belongs to this clinic (prevents cross-clinic manipulation)
  if (dentistId) {
    const dentist = await prisma.dentist.findFirst({
      where: { id: dentistId, clinicId: caller.clinicId, isDeleted: false },
    })
    if (!dentist) {
      return NextResponse.json({ error: 'Dentist not found' }, { status: 404 })
    }
  }

  // Conflict check for specific dentist
  if (dentistId) {
    const overlap = await prisma.appointment.findFirst({
      where: {
        dentistId,
        isDeleted: false,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        scheduledAt: { lt: endsAt },
        endsAt: { gt: apptDate },
      },
    })
    if (overlap) {
      return NextResponse.json({ error: 'That dentist has a conflicting appointment at this time' }, { status: 409 })
    }
  }

  // Generate appointmentCode
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

  const appointment = await prisma.appointment.create({
    data: {
      clinicId:   caller.clinicId,
      patientId:  caller.patientId,
      serviceId,
      dentistId:  dentistId || null,
      scheduledAt: apptDate,
      endsAt,
      status: 'PENDING',
      notes: notes || null,
      appointmentCode,
      statusHistory: {
        create: { status: 'PENDING', changedById: caller.userId },
      },
    },
  })

  // Notify all receptionists and admins of the new booking request
  const patient = await prisma.patient.findUnique({
    where: { id: caller.patientId },
    select: { firstName: true, lastName: true },
  })
  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'A patient'
  await notifyStaffBooking({
    clinicId: caller.clinicId,
    appointmentId: appointment.id,
    patientName,
    serviceName: service.name,
    scheduledAt: apptDate,
    appointmentCode,
  })

  logAudit({ userId: caller.userId, clinicId: caller.clinicId, action: 'CREATE', entity: 'Appointment', entityId: appointment.id, ipAddress: ip, userAgent, metadata: { appointmentCode, source: 'patient-booking' } })

  return NextResponse.json({ appointment }, { status: 201 })
}
