/**
 * lib/notifications.js — Dual-Channel Notification System
 *
 * Every appointment event triggers both in-app (bell icon) and email notifications.
 * Email calls are always fire-and-forget (.catch(() => {})) — email failures
 * never block or roll back the primary database operation.
 *
 * Notification routing:
 *   notifyStaffBooking        → all RECEPTIONIST + ADMIN in clinic (in-app + email)
 *   notifyPatientStatusChange → the patient whose appointment changed (in-app + email)
 *   notifyStaff               → all RECEPTIONIST + ADMIN in clinic (in-app only)
 *   sendAppointmentReminder   → the patient (in-app + email, called by cron job)
 */
import moment from 'moment-timezone'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import {
  sendAppointmentBookingEmail,
  sendAppointmentConfirmedEmail,
  sendAppointmentCancelledEmail,
  sendAppointmentCompletedEmail,
  sendAppointmentNoShowEmail,
  sendAppointmentRescheduledEmail,
  sendAppointmentReminderEmail,
} from '@/lib/email'

/**
 * Create a single in-app notification for one user.
 */
export async function createNotification({ userId, clinicId, type, title, body, appointmentId }) {
  return prisma.inAppNotification.create({
    data: { userId, clinicId, type, title, body, appointmentId: appointmentId ?? null },
  })
}

/**
 * Notify all RECEPTIONIST and ADMIN users in a clinic (in-app only).
 */
export async function notifyStaff({ clinicId, type, title, body, appointmentId }) {
  const staff = await prisma.user.findMany({
    where: { clinicId, role: { in: [ROLES.RECEPTIONIST, ROLES.ADMIN] }, isDeleted: false },
    select: { id: true },
  })
  if (!staff.length) return
  await prisma.inAppNotification.createMany({
    data: staff.map((u) => ({ userId: u.id, clinicId, type, title, body, appointmentId: appointmentId ?? null })),
  })
}

/**
 * Notify all staff (in-app) + send booking-request email to each staff member.
 */
export async function notifyStaffBooking({ clinicId, appointmentId, patientName, serviceName, scheduledAt, appointmentCode }) {
  const staff = await prisma.user.findMany({
    where: { clinicId, role: { in: [ROLES.RECEPTIONIST, ROLES.ADMIN] }, isDeleted: false },
    select: { id: true, email: true, firstName: true },
  })
  if (!staff.length) return

  const title = 'New Booking Request'
  const body  = `${patientName} requested ${serviceName}.`

  await prisma.inAppNotification.createMany({
    data: staff.map((u) => ({
      userId: u.id, clinicId, type: 'BOOKING_REQUEST', title, body, appointmentId: appointmentId ?? null,
    })),
  })

  // Email staff concurrently — fire-and-forget, don't block on failures
  await Promise.allSettled(
    staff.map((u) =>
      sendAppointmentBookingEmail({
        to: u.email,
        staffName: u.firstName,
        patientName,
        serviceName,
        scheduledAt,
        appointmentCode,
      }).catch(() => {})
    )
  )
}

/**
 * Notify a single patient (in-app + email) about an appointment status change.
 */
export async function notifyPatientStatusChange({
  userId,
  clinicId,
  appointmentId,
  status,
  patientEmail,
  patientFirstName,
  serviceName,
  scheduledAt,
  appointmentCode,
}) {
  const scheduledStr = moment(scheduledAt).tz('Asia/Manila').format('MMM D, YYYY')

  const NOTIF = {
    CONFIRMED:    { type: 'APPOINTMENT_CONFIRMED',   title: 'Appointment Confirmed',    body: `Your ${serviceName} on ${scheduledStr} has been confirmed.` },
    CANCELLED:    { type: 'APPOINTMENT_CANCELLED',   title: 'Appointment Cancelled',    body: `Your ${serviceName} on ${scheduledStr} has been cancelled.` },
    COMPLETED:    { type: 'APPOINTMENT_COMPLETED',   title: 'Appointment Completed',    body: `Your ${serviceName} on ${scheduledStr} is marked as completed. Thank you!` },
    NO_SHOW:      { type: 'APPOINTMENT_NO_SHOW',     title: 'Appointment No-show',      body: `You were marked as no-show for ${serviceName} on ${scheduledStr}.` },
    RESCHEDULED:  { type: 'APPOINTMENT_RESCHEDULED', title: 'Appointment Rescheduled',  body: `Your ${serviceName} has been rescheduled.` },
  }

  const n = NOTIF[status]
  if (!n) return

  // In-app
  await createNotification({ userId, clinicId, type: n.type, title: n.title, body: n.body, appointmentId })

  // Email (fire-and-forget)
  if (patientEmail) {
    const emailFn = {
      CONFIRMED:   () => sendAppointmentConfirmedEmail({ to: patientEmail, firstName: patientFirstName, serviceName, scheduledAt, appointmentCode }),
      CANCELLED:   () => sendAppointmentCancelledEmail({ to: patientEmail, firstName: patientFirstName, serviceName, scheduledAt, appointmentCode }),
      COMPLETED:   () => sendAppointmentCompletedEmail({ to: patientEmail, firstName: patientFirstName, serviceName, scheduledAt }),
      NO_SHOW:     () => sendAppointmentNoShowEmail({ to: patientEmail, firstName: patientFirstName, serviceName, scheduledAt }),
      RESCHEDULED: () => sendAppointmentRescheduledEmail({ to: patientEmail, firstName: patientFirstName, serviceName, scheduledAt, appointmentCode }),
    }[status]
    emailFn?.().catch(() => {})
  }
}

/**
 * Send reminder notifications (in-app + email) for a single appointment.
 * hoursAhead: 24 | 2
 */
export async function sendAppointmentReminder({ appointment, hoursAhead }) {
  const { patient, service, scheduledAt, appointmentCode, clinicId, id: appointmentId } = appointment
  const userId       = patient?.user?.id
  const patientEmail = patient?.user?.email
  const firstName    = patient?.user?.firstName ?? patient?.firstName
  const serviceName  = service?.name ?? 'your appointment'

  const type  = hoursAhead === 2 ? 'REMINDER_2H' : 'REMINDER_24H'
  const label = hoursAhead === 2 ? 'in 2 hours' : 'tomorrow'
  const title = hoursAhead === 2 ? 'Appointment in 2 Hours' : 'Appointment Tomorrow'
  const body  = `Reminder: ${serviceName} is scheduled ${label}.`

  if (userId) {
    await createNotification({ userId, clinicId, type, title, body, appointmentId }).catch(() => {})
  }

  if (patientEmail) {
    sendAppointmentReminderEmail({
      to: patientEmail,
      firstName,
      serviceName,
      scheduledAt,
      appointmentCode,
      hoursAhead,
    }).catch(() => {})
  }
}
