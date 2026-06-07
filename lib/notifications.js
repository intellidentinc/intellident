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
  sendCustomAppointmentEmail,
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

function getTypeConfig(notifConfig, type) {
  if (!notifConfig || typeof notifConfig !== 'object') return { inApp: true, email: true }
  const cfg = notifConfig[type]
  return { inApp: cfg?.inApp !== false, email: cfg?.email !== false }
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

function getCustomTemplate(notifConfig, type, vars) {
  if (!notifConfig || typeof notifConfig !== 'object') return null
  const cfg = notifConfig[type]
  if (!cfg?.emailSubject && !cfg?.emailBody) return null
  return {
    subject: cfg.emailSubject ? renderTemplate(cfg.emailSubject, vars) : null,
    body:    cfg.emailBody    ? renderTemplate(cfg.emailBody,    vars) : null,
  }
}

async function fetchNotifConfig(clinicId) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { notifConfig: true } })
  return clinic?.notifConfig ?? null
}

/**
 * Notify all staff (in-app) + send booking-request email to each staff member.
 */
export async function notifyStaffBooking({ clinicId, appointmentId, patientName, serviceName, scheduledAt, appointmentCode }) {
  const [staff, notifConfig] = await Promise.all([
    prisma.user.findMany({
      where: { clinicId, role: { in: [ROLES.RECEPTIONIST, ROLES.ADMIN] }, isDeleted: false },
      select: { id: true, email: true, firstName: true },
    }),
    fetchNotifConfig(clinicId),
  ])
  if (!staff.length) return

  const cfg   = getTypeConfig(notifConfig, 'BOOKING_REQUEST')
  const title = 'New Booking Request'
  const body  = `${patientName} requested ${serviceName}.`

  if (cfg.inApp) {
    await prisma.inAppNotification.createMany({
      data: staff.map((u) => ({
        userId: u.id, clinicId, type: 'BOOKING_REQUEST', title, body, appointmentId: appointmentId ?? null,
      })),
    })
  }

  if (cfg.email) {
    const vars = { patientName, serviceName, scheduledAt: moment(scheduledAt).tz('Asia/Manila').format('MMM D, YYYY h:mm A'), appointmentCode: appointmentCode ?? '' }
    const tpl = getCustomTemplate(notifConfig, 'BOOKING_REQUEST', vars)
    await Promise.allSettled(
      staff.map((u) => {
        const staffVars = { ...vars, firstName: u.firstName }
        const staffTpl = tpl ? { subject: tpl.subject ? renderTemplate(tpl.subject, staffVars) : tpl.subject, body: tpl.body ? renderTemplate(tpl.body, staffVars) : tpl.body } : null
        return staffTpl
          ? sendCustomAppointmentEmail({ to: u.email, subject: staffTpl.subject ?? 'New Appointment Booking Request', body: staffTpl.body ?? body, typeKey: 'BOOKING_REQUEST' }).catch(() => {})
          : sendAppointmentBookingEmail({ to: u.email, staffName: u.firstName, patientName, serviceName, scheduledAt, appointmentCode }).catch(() => {})
      })
    )
  }
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

  const notifConfig = await fetchNotifConfig(clinicId)
  const cfg = getTypeConfig(notifConfig, n.type)

  if (cfg.inApp) {
    await createNotification({ userId, clinicId, type: n.type, title: n.title, body: n.body, appointmentId })
  }

  if (cfg.email && patientEmail) {
    const vars = { firstName: patientFirstName, patientName: patientFirstName, serviceName, scheduledAt: scheduledStr, appointmentCode: appointmentCode ?? '' }
    const tpl = getCustomTemplate(notifConfig, n.type, vars)
    if (tpl) {
      sendCustomAppointmentEmail({ to: patientEmail, subject: tpl.subject ?? n.title, body: tpl.body ?? n.body, typeKey: n.type }).catch(() => {})
    } else {
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
}

/**
 * Send reminder notifications (in-app + email) for a single appointment.
 * hoursAhead: number (the clinic-configured reminder interval)
 * notifConfig: optional pre-fetched clinic notifConfig (avoids extra DB query from cron)
 */
export async function sendAppointmentReminder({ appointment, hoursAhead, notifConfig }) {
  const { patient, service, scheduledAt, appointmentCode, clinicId, id: appointmentId } = appointment
  const userId       = patient?.user?.id
  const patientEmail = patient?.user?.email
  const firstName    = patient?.user?.firstName ?? patient?.firstName
  const serviceName  = service?.name ?? 'your appointment'

  const type  = hoursAhead <= 2 ? 'REMINDER_2H' : 'REMINDER_24H'
  const label = hoursAhead <= 2 ? `in ${hoursAhead} hour${hoursAhead === 1 ? '' : 's'}` : `in ${hoursAhead} hours`
  const title = hoursAhead <= 2 ? `Appointment in ${hoursAhead} Hour${hoursAhead === 1 ? '' : 's'}` : `Appointment in ${hoursAhead} Hours`
  const body  = `Reminder: ${serviceName} is scheduled ${label}.`

  const cfg = getTypeConfig(notifConfig ?? null, type)

  if (cfg.inApp && userId) {
    await createNotification({ userId, clinicId, type, title, body, appointmentId }).catch(() => {})
  }

  if (cfg.email && patientEmail) {
    const vars = { firstName, patientName: firstName, serviceName, scheduledAt: moment(scheduledAt).tz('Asia/Manila').format('MMM D, YYYY h:mm A'), appointmentCode: appointmentCode ?? '' }
    const tpl = getCustomTemplate(notifConfig ?? null, type, vars)
    if (tpl) {
      sendCustomAppointmentEmail({ to: patientEmail, subject: tpl.subject ?? title, body: tpl.body ?? body, typeKey: type }).catch(() => {})
    } else {
      sendAppointmentReminderEmail({ to: patientEmail, firstName, serviceName, scheduledAt, appointmentCode, hoursAhead }).catch(() => {})
    }
  }
}
