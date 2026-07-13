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
import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyStaffBooking } from '@/lib/notifications'
import { getActivePatientContext } from '@/lib/patient-context'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str } from '@/lib/validate'
import { generateAppointmentCode, getPatientAppointments } from '@/lib/appointments'
import { assertNoConflict, BookingConflictError } from '@/lib/appointment-conflicts'
import { generateReceiptNumber } from '@/lib/billing'
import { createCheckoutSession } from '@/lib/paymongo'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

async function getPatientCaller() {
  return getActivePatientContext()
}

export async function GET(request) {
  const caller = await getPatientCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') ?? 'upcoming'

  const appointments = await getPatientAppointments(caller.patientId, tab)

  return NextResponse.json({ appointments })
}

export async function POST(request) {
  const caller = await getPatientCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const rawServiceIds = parsed.body.serviceIds ?? (parsed.body.serviceId ? [parsed.body.serviceId] : [])
  const serviceIds = (Array.isArray(rawServiceIds) ? rawServiceIds : [rawServiceIds])
    .filter((id) => typeof id === 'string' && id.trim().length > 0)
  const dentistId   = parsed.body.dentistId ? str(parsed.body.dentistId, 50) : undefined
  const scheduledAt = str(parsed.body.scheduledAt, 50)
  const notes       = str(parsed.body.notes, 2000)

  if (serviceIds.length === 0 || !scheduledAt) {
    return NextResponse.json({ error: 'serviceIds and scheduledAt are required' }, { status: 400 })
  }

  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, clinicId: caller.clinicId, isDeleted: false },
  })
  if (services.length !== serviceIds.length) {
    return NextResponse.json({ error: 'One or more services not found' }, { status: 404 })
  }
  // preserve selection order
  const orderedServices = serviceIds.map(id => services.find(s => s.id === id))
  const service = orderedServices[0]

  const [schedule, closures, clinic] = await Promise.all([
    prisma.clinicSchedule.findUnique({ where: { clinicId: caller.clinicId } }),
    prisma.clinicClosure.findMany({ where: { clinicId: caller.clinicId } }),
    prisma.clinic.findUnique({ where: { id: caller.clinicId }, select: { code: true } }),
  ])

  const apptDate = new Date(scheduledAt)

  // Reject past-dated bookings
  if (isNaN(apptDate.getTime()) || apptDate.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Appointment time must be in the future' }, { status: 400 })
  }

  // Evaluate the calendar day in Manila time so the working-day and closure checks match
  // the clinic's local calendar (mirrors the receptionist route).
  const apptPHT = dayjs(apptDate).tz('Asia/Manila')

  // Validate working day (PHT)
  if (schedule?.workingDays?.length) {
    const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const dayName = DAY_NAMES[apptPHT.day()]
    if (!schedule.workingDays.includes(dayName)) {
      return NextResponse.json({ error: `${dayName} is not a working day` }, { status: 400 })
    }
  }

  // Validate not a closure (PHT)
  const dateStr = apptPHT.format('YYYY-MM-DD')
  if (closures.some(c => dayjs(c.date).tz('Asia/Manila').format('YYYY-MM-DD') === dateStr)) {
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

  const totalDuration = orderedServices.reduce((sum, s) => sum + s.duration + s.bufferTime, 0)
  const endsAt = new Date(apptDate.getTime() + totalDuration * 60 * 1000)

  // Verify dentistId belongs to this clinic (prevents cross-clinic manipulation)
  if (dentistId) {
    const dentist = await prisma.dentist.findFirst({
      where: { id: dentistId, clinicId: caller.clinicId, isDeleted: false },
    })
    if (!dentist) {
      return NextResponse.json({ error: 'Dentist not found' }, { status: 404 })
    }
  }

  // Generate appointmentCode
  const clinicCode = clinic?.code ?? 'CLN'
  const datePart = `${apptDate.getFullYear()}/${String(apptDate.getMonth() + 1).padStart(2, '0')}/${String(apptDate.getDate()).padStart(2, '0')}`

  // Conflict check + code generation + create run in one transaction so the
  // advisory locks hold until the row is written (no double-booking, no
  // duplicate codes). assertNoConflict must run first — consistent lock order.
  let appointment
  try {
    appointment = await prisma.$transaction(async (tx) => {
      await assertNoConflict(tx, {
        clinicId: caller.clinicId,
        dentistId: dentistId || null,
        scheduledAt: apptDate,
        endsAt,
      })
      const appointmentCode = await generateAppointmentCode(caller.clinicId, clinicCode, datePart, tx)
      return tx.appointment.create({
        data: {
          clinicId:   caller.clinicId,
          patientId:  caller.patientId,
          serviceId:  service.id,
          dentistId:  dentistId || null,
          scheduledAt: apptDate,
          endsAt,
          status: 'PENDING',
          notes: notes || null,
          appointmentCode,
          services: {
            create: orderedServices.map((s, i) => ({ serviceId: s.id, order: i })),
          },
          statusHistory: {
            create: { status: 'PENDING', changedById: caller.userId },
          },
        },
      })
    })
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    throw err
  }
  const { appointmentCode } = appointment

  // Notify all receptionists and admins of the new booking request.
  // Patient name comes from getPatientCaller() — no extra query needed.
  const patientName = caller.firstName ? `${caller.firstName} ${caller.lastName}` : 'A patient'
  after(
    notifyStaffBooking({
      clinicId: caller.clinicId,
      appointmentId: appointment.id,
      patientName,
      serviceName: service.name,
      scheduledAt: apptDate,
      appointmentCode,
    }).catch((err) => console.error('notifyStaffBooking failed:', err))
  )

  logAudit({ userId: caller.userId, clinicId: caller.clinicId, action: 'CREATE', entity: 'Appointment', entityId: appointment.id, ipAddress: ip, userAgent, metadata: { appointmentCode, source: 'patient-booking' } })

  // Create RESERVATION billing immediately and redirect patient to pay the deposit.
  // Best-effort: booking always succeeds even if billing or checkout fails.
  let checkoutUrl = null
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: caller.clinicId },
      select: { paymongoEnabled: true, reservationFeeEnabled: true, reservationFeeAmount: true },
    })
    const reservationFee = clinic?.reservationFeeAmount ?? 0
    if (clinic?.paymongoEnabled && clinic?.reservationFeeEnabled && reservationFee > 0) {
      const resBilling = await prisma.$transaction(async (tx) => {
        const receiptNumber = await generateReceiptNumber(caller.clinicId, tx)
        return tx.billing.create({
          data: {
            clinicId:     caller.clinicId,
            patientId:    caller.patientId,
            appointmentId: appointment.id,
            billingType:  'RESERVATION',
            amount:       reservationFee,
            amountPaid:   0,
            balance:      reservationFee,
            status:       'UNPAID',
            receiptNumber,
          },
        })
      })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const result = await createCheckoutSession({
        lineItems: [{
          amount:   Math.round(reservationFee * 100),
          currency: 'PHP',
          name:     `Reservation Deposit — ${service.name}`,
          quantity: 1,
        }],
        successUrl: `${appUrl}/${caller.clinicId}/my-billing?payment=success&billingId=${resBilling.id}`,
        cancelUrl:  `${appUrl}/${caller.clinicId}/schedules`,
        metadata:   { billingId: resBilling.id, clinicId: caller.clinicId, paymentType: 'RESERVATION' },
      }).catch(() => ({ checkoutUrl: null }))
      checkoutUrl = result.checkoutUrl
    }
  } catch {
    // Non-blocking — booking succeeded regardless
  }

  return NextResponse.json({ appointment, ...(checkoutUrl ? { checkoutUrl } : {}) }, { status: 201 })
}
