/**
 * /api/appointments/[id] — RECEPTIONIST + ADMIN only
 *
 * Key features implemented here:
 *
 * GET  — Appointment detail including full status history timeline with
 *         the name of whoever made each transition (changedBy).
 *
 * PATCH — Status transition state machine enforced server-side via ALLOWED_TRANSITIONS.
 *   Valid transitions:
 *     PENDING   → CONFIRMED | CANCELLED
 *     CONFIRMED → COMPLETED | CANCELLED | NO_SHOW | RESCHEDULED
 *   Terminal states (COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED) reject all transitions.
 *
 *   Every transition:
 *     - Records an AppointmentStatusHistory entry with changedById + optional note
 *     - Sends in-app + email notification to the patient via notifyPatientStatusChange
 *     - On CANCELLED: additionally notifies all staff in-app via notifyStaff
 */
import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyPatientStatusChange, notifyStaff, createNotification } from '@/lib/notifications'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str } from '@/lib/validate'
import { generateReceiptNumber, computeBillingStatus } from '@/lib/billing'
import { createCheckoutSession } from '@/lib/paymongo'
import { sendCustomAppointmentEmail } from '@/lib/email'

async function getCaller() {
  const session = await getSession()
  if (!session) return null
  const caller = await getAuthContext()
  if (!caller || ![ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.SUPERADMIN].includes(caller.role)) return null
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  return { ...caller, clinicId }
}

const ALLOWED_TRANSITIONS = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
}

export async function GET(request, { params }) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const appointment = await prisma.appointment.findFirst({
    where: { id, clinicId: caller.clinicId, isDeleted: false },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
      service: { select: { name: true, duration: true } },
      statusHistory: {
        orderBy: { changedAt: 'asc' },
        include: {
          changedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(appointment)
}

export async function PATCH(request, { params }) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const { id } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { status, dentistId } = parsed.body
  const note = str(parsed.body.note, 2000)

  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })

  const appointment = await prisma.appointment.findFirst({
    where: { id, clinicId: caller.clinicId, isDeleted: false },
  })
  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = ALLOWED_TRANSITIONS[appointment.status] ?? []
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${appointment.status} to ${status}` },
      { status: 400 }
    )
  }

  // Assign a dentist when confirming an "Any Available" booking (dentistId was null).
  // Required so a confirmed appointment is never left unassigned.
  let assignDentistId = null
  if (status === 'CONFIRMED' && !appointment.dentistId && dentistId) {
    const dentist = await prisma.dentist.findFirst({
      where: { id: dentistId, clinicId: caller.clinicId, isDeleted: false },
      select: { id: true },
    })
    if (!dentist) {
      return NextResponse.json({ error: 'Selected dentist not found in this clinic' }, { status: 400 })
    }
    const overlap = await prisma.appointment.findFirst({
      where: {
        clinicId: caller.clinicId,
        dentistId,
        isDeleted: false,
        id: { not: id },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [{ scheduledAt: { lt: appointment.endsAt }, endsAt: { gt: appointment.scheduledAt } }],
      },
    })
    if (overlap) {
      return NextResponse.json({ error: 'This dentist has a conflicting appointment at that time' }, { status: 409 })
    }
    assignDentistId = dentist.id
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status,
      ...(assignDentistId ? { dentistId: assignDentistId } : {}),
      statusHistory: {
        create: {
          status,
          changedById: caller.id,
          note: note || null,
        },
      },
    },
    include: {
      patient: {
        include: {
          user: { select: { id: true, email: true, firstName: true } },
        },
      },
      service: { select: { name: true } },
    },
  })

  const patientUser   = updated.patient?.user
  const serviceName   = updated.service?.name ?? 'your appointment'
  const appointmentCode = appointment.appointmentCode

  // Notify patient about their status change
  if (patientUser?.id) {
    await notifyPatientStatusChange({
      userId: patientUser.id,
      clinicId: caller.clinicId,
      appointmentId: id,
      status,
      patientEmail: patientUser.email,
      patientFirstName: patientUser.firstName,
      serviceName,
      scheduledAt: appointment.scheduledAt,
      appointmentCode,
    }).catch(() => {})
  }

  // Notify staff when appointment is cancelled (patient-initiated info for staff)
  if (status === 'CANCELLED') {
    const patientName = updated.patient
      ? `${updated.patient.firstName} ${updated.patient.lastName}`.trim()
      : 'A patient'
    await notifyStaff({
      clinicId: caller.clinicId,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Appointment Cancelled',
      body: `${patientName}'s ${serviceName} appointment has been cancelled.`,
      appointmentId: id,
    }).catch(() => {})
  }

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'UPDATE', entity: 'Appointment', entityId: id, ipAddress: ip, userAgent, metadata: { from: appointment.status, to: status, appointmentCode: appointment.appointmentCode } })

  // Auto-create or finalize billing when appointment is COMPLETED
  if (status === 'COMPLETED') {
    try {
      // Sum prices across all services in the junction table; fall back to single service for old records
      const junctionServices = await prisma.appointmentService.findMany({
        where: { appointmentId: id },
        include: { service: { select: { price: true } } },
      })
      const totalPrice = junctionServices.length > 0
        ? junctionServices.reduce((sum, js) => sum + (js.service.price ?? 0), 0)
        : (updated.service?.price ?? 0)

      const existingBilling = await prisma.billing.findUnique({
        where: { appointmentId: id },
        include: { payments: { where: { isDeleted: false } } },
      })

      if (!existingBilling) {
        await prisma.$transaction(async (tx) => {
          const receiptNumber = await generateReceiptNumber(caller.clinicId, tx)
          await tx.billing.create({
            data: {
              clinicId:      caller.clinicId,
              patientId:     updated.patient.id,
              appointmentId: id,
              amount:        totalPrice,
              amountPaid:    0,
              balance:       totalPrice,
              status:        'UNPAID',
              receiptNumber,
            },
          })
        })
      } else if (!existingBilling.receiptNumber) {
        await prisma.$transaction(async (tx) => {
          const receiptNumber = await generateReceiptNumber(caller.clinicId, tx)
          await tx.billing.update({
            where: { id: existingBilling.id },
            data: { receiptNumber },
          })
        })
      }
    } catch {
      // Billing auto-creation is non-blocking
    }
  }

  // Reservation deposit: when staff CONFIRM a booking, create the billing record
  // (the deposit is credited toward the full appointment total) and hand the patient a
  // pay link. Done here — not at PENDING request time — so a rejected/abandoned request
  // never leaves an orphan bill behind.
  if (appointment.status === 'PENDING' && status === 'CONFIRMED') {
    try {
      const clinic = await prisma.clinic.findUnique({
        where: { id: caller.clinicId },
        select: { reservationFeeAmount: true, paymongoEnabled: true },
      })
      const reservationFee = clinic?.reservationFeeAmount ?? 0
      const existingBilling = clinic?.paymongoEnabled && reservationFee > 0
        ? await prisma.billing.findUnique({ where: { appointmentId: id } })
        : null

      if (clinic?.paymongoEnabled && reservationFee > 0 && !existingBilling) {
        const junctionServices = await prisma.appointmentService.findMany({
          where: { appointmentId: id },
          include: { service: { select: { price: true } } },
        })
        const totalPrice = junctionServices.length > 0
          ? junctionServices.reduce((sum, js) => sum + (js.service.price ?? 0), 0)
          : (updated.service?.price ?? 0)

        const billing = await prisma.$transaction(async (tx) => {
          const receiptNumber = await generateReceiptNumber(caller.clinicId, tx)
          return tx.billing.create({
            data: {
              clinicId:      caller.clinicId,
              patientId:     updated.patient.id,
              appointmentId: id,
              amount:        totalPrice,
              amountPaid:    0,
              balance:       totalPrice,
              status:        'UNPAID',
              receiptNumber,
            },
          })
        })

        // Best-effort: build a checkout link for the reservation deposit and send it to the patient.
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        const { checkoutUrl } = await createCheckoutSession({
          lineItems: [{
            amount:   Math.round(reservationFee * 100),
            currency: 'PHP',
            name:     `Reservation Deposit — ${serviceName}`,
            quantity: 1,
          }],
          successUrl: `${appUrl}/${caller.clinicId}/my-billing?payment=success&billingId=${billing.id}`,
          cancelUrl:  `${appUrl}/${caller.clinicId}/my-billing`,
          metadata:   { billingId: billing.id, clinicId: caller.clinicId, paymentType: 'RESERVATION' },
        }).catch(() => ({ checkoutUrl: null }))

        if (checkoutUrl && patientUser?.id) {
          await createNotification({
            userId: patientUser.id,
            clinicId: caller.clinicId,
            type: 'APPOINTMENT_CONFIRMED',
            title: 'Reservation Deposit Due',
            body: `Secure your ${serviceName} appointment by paying the ₱${reservationFee} reservation deposit (credited toward your total): ${checkoutUrl}`,
            appointmentId: id,
          }).catch(() => {})

          if (patientUser.email) {
            sendCustomAppointmentEmail({
              to: patientUser.email,
              subject: 'Secure Your Appointment — Reservation Deposit',
              body: `Hi ${patientUser.firstName ?? ''},\n\nYour ${serviceName} appointment is confirmed. Please pay the ₱${reservationFee} reservation deposit to secure your slot:\n\n${checkoutUrl}\n\nThe deposit is credited toward your total bill.`,
              typeKey: 'APPOINTMENT_CONFIRMED',
            }).catch(() => {})
          }
        }
      }
    } catch {
      // Reservation billing/deposit setup is non-blocking — confirmation still succeeds.
    }
  }

  return NextResponse.json({ appointment: updated })
}
