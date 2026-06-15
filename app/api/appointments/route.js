/**
 * /api/appointments — RECEPTIONIST + ADMIN only
 *
 * Key features implemented here:
 *
 * GET  — Paginated appointment list with filters (status, dentistId, serviceId)
 *         and full-text search on patient name + appointment code.
 *         All queries are scoped to caller.clinicId (multi-tenancy zero trust).
 *
 * POST — Create appointment with 5-step server-side validation:
 *   1. Working day check  (ClinicSchedule.workingDays)
 *   2. Closure check      (ClinicClosure dates)
 *   3. Operating hours    (openTime ≤ scheduledAt < closeTime)
 *   4. Dentist conflict   (overlap detection against existing non-cancelled appointments)
 *   5. endsAt calculation (scheduledAt + service.duration + service.bufferTime)
 *
 *   Also generates the appointmentCode: APT-{CLINICCODE}-{YYYY/MM/DD}-{####}
 *   If the appointment is created directly as CONFIRMED, the patient is notified
 *   via in-app notification + email (same as the PENDING→CONFIRMED transition).
 */
import { NextResponse } from 'next/server'
import moment from 'moment-timezone'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyPatientStatusChange } from '@/lib/notifications'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str } from '@/lib/validate'
import { generateAppointmentCode } from '@/lib/appointments'

async function getCaller() {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true, id: true },
  })
  if (!caller || ![ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.SUPERADMIN].includes(caller.role)) return null
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  return { ...caller, clinicId }
}

export async function GET(request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page      = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const pageSize  = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10)))
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
        dentist: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
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

  const { ip, userAgent } = getRequestMeta(request)
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const rawServiceIds = parsed.body.serviceIds ?? (parsed.body.serviceId ? [parsed.body.serviceId] : [])
  const serviceIds = Array.isArray(rawServiceIds) ? rawServiceIds.filter(Boolean) : [rawServiceIds].filter(Boolean)
  const { patientId, dentistId, scheduledAt, status } = parsed.body
  const notes = str(parsed.body.notes, 2000)

  if (!patientId || serviceIds.length === 0 || !scheduledAt) {
    return NextResponse.json({ error: 'patientId, serviceIds, and scheduledAt are required' }, { status: 400 })
  }

  // Tenant check: the patient must belong to the caller's clinic — prevents
  // referencing another clinic's patient record (cross-tenant manipulation/leak).
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId: caller.clinicId, isDeleted: false },
    select: { id: true },
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // Tenant check: the chosen dentist (if any) must belong to the caller's clinic.
  if (dentistId) {
    const dentist = await prisma.dentist.findFirst({
      where: { id: dentistId, clinicId: caller.clinicId, isDeleted: false },
      select: { id: true },
    })
    if (!dentist) {
      return NextResponse.json({ error: 'Dentist not found' }, { status: 404 })
    }
  }

  // Fetch all services for duration/buffer aggregation
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, clinicId: caller.clinicId, isDeleted: false },
  })
  if (services.length !== serviceIds.length) {
    return NextResponse.json({ error: 'One or more services not found' }, { status: 404 })
  }
  const orderedServices = serviceIds.map(id => services.find(s => s.id === id))
  const service = orderedServices[0]

  // Fetch clinic schedule + closures
  const [schedule, closures, clinic] = await Promise.all([
    prisma.clinicSchedule.findUnique({ where: { clinicId: caller.clinicId } }),
    prisma.clinicClosure.findMany({ where: { clinicId: caller.clinicId } }),
    prisma.clinic.findUnique({ where: { id: caller.clinicId }, select: { code: true } }),
  ])

  const apptDate = new Date(scheduledAt)
  const apptManila = moment(scheduledAt).tz('Asia/Manila')

  // Validate working day (in Manila timezone)
  if (schedule?.workingDays?.length) {
    const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const dayName = DAY_NAMES[apptManila.day()]
    if (!schedule.workingDays.includes(dayName)) {
      return NextResponse.json({ error: `${dayName} is not a working day` }, { status: 400 })
    }
  }

  // Validate not a closure (compare in Manila timezone)
  const manilaDateStr = apptManila.format('YYYY-MM-DD')
  const isClosure = closures.some((c) => moment(c.date).tz('Asia/Manila').format('YYYY-MM-DD') === manilaDateStr)
  if (isClosure) {
    return NextResponse.json({ error: 'This date is a clinic closure' }, { status: 400 })
  }

  // Validate operating hours (in Manila timezone)
  if (schedule) {
    const [openH, openM]   = schedule.openTime.split(':').map(Number)
    const [closeH, closeM] = schedule.closeTime.split(':').map(Number)
    const apptMinutes  = apptManila.hours() * 60 + apptManila.minutes()
    const openMinutes  = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM
    if (apptMinutes < openMinutes || apptMinutes >= closeMinutes) {
      return NextResponse.json({ error: `Appointment must be between ${schedule.openTime} and ${schedule.closeTime}` }, { status: 400 })
    }
  }

  const totalDuration = orderedServices.reduce((sum, s) => sum + s.duration + s.bufferTime, 0)
  const endsAt = new Date(apptDate.getTime() + totalDuration * 60 * 1000)

  // Dentist conflict check (only if specific dentist chosen)
  if (dentistId) {
    const overlap = await prisma.appointment.findFirst({
      where: {
        clinicId: caller.clinicId,
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

  // Generate appointmentCode: APT-{CLINICCODE}-{YYYY/MM/DD}-{####} (date in Manila timezone)
  const clinicCode = clinic?.code ?? 'CLN'
  const datePart = apptManila.format('YYYY/MM/DD')

  const initialStatus = ['PENDING', 'CONFIRMED'].includes(status) ? status : 'PENDING'

  // Code generation + create run in one transaction so the advisory lock in
  // generateAppointmentCode holds until the row is written (no duplicate codes).
  const appointment = await prisma.$transaction(async (tx) => {
    const appointmentCode = await generateAppointmentCode(caller.clinicId, clinicCode, datePart, tx)
    return tx.appointment.create({
      data: {
        clinicId: caller.clinicId,
        patientId,
        serviceId: service.id,
        dentistId: dentistId || null,
        scheduledAt: apptDate,
        endsAt,
        status: initialStatus,
        notes: notes || null,
        appointmentCode,
        services: {
          create: orderedServices.map((s, i) => ({ serviceId: s.id, order: i })),
        },
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
  })
  const { appointmentCode } = appointment

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

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'CREATE', entity: 'Appointment', entityId: appointment.id, ipAddress: ip, userAgent, metadata: { appointmentCode, status: initialStatus } })

  return NextResponse.json({ appointment }, { status: 201 })
}
