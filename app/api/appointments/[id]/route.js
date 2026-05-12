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
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyPatientStatusChange, notifyStaff } from '@/lib/notifications'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str } from '@/lib/validate'
import { generateReceiptNumber, computeBillingStatus } from '@/lib/billing'

async function getCaller() {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true, id: true, firstName: true, lastName: true },
  })
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
  const { status } = parsed.body
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

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status,
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
      const servicePrice = updated.service ? (await prisma.service.findUnique({ where: { id: updated.serviceId ?? appointment.serviceId } }))?.price ?? 0 : 0
      const existingBilling = await prisma.billing.findUnique({
        where: { appointmentId: id },
        include: { payments: { where: { isDeleted: false } } },
      })

      if (!existingBilling) {
        const receiptNumber = await generateReceiptNumber(caller.clinicId)
        await prisma.billing.create({
          data: {
            clinicId:      caller.clinicId,
            patientId:     updated.patient.id,
            appointmentId: id,
            amount:        servicePrice,
            amountPaid:    0,
            balance:       servicePrice,
            status:        'UNPAID',
            receiptNumber,
          },
        })
      } else if (!existingBilling.receiptNumber) {
        const receiptNumber = await generateReceiptNumber(caller.clinicId)
        await prisma.billing.update({
          where: { id: existingBilling.id },
          data: { receiptNumber },
        })
      }
    } catch {
      // Billing auto-creation is non-blocking
    }
  }

  return NextResponse.json({ appointment: updated })
}
