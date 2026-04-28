# Notification System

## Overview
All appointment events generate both **in-app notifications** (bell icon) and **email notifications** (Mailjet). There is no separate Reminders page — the bell icon in `PageHeader` opens a Framer Motion slide-in drawer.

## `lib/notifications.js` Helpers

| Function | Purpose |
|---|---|
| `createNotification({ userId, clinicId, type, title, body, appointmentId })` | Single in-app notification for one user |
| `notifyStaff({ clinicId, type, title, body, appointmentId })` | In-app only to all RECEPTIONIST + ADMIN users in clinic |
| `notifyStaffBooking({ clinicId, appointmentId, patientName, serviceName, scheduledAt, appointmentCode })` | In-app + email to staff on new patient booking |
| `notifyPatientStatusChange({ userId, clinicId, appointmentId, status, patientEmail, patientFirstName, serviceName, scheduledAt, appointmentCode })` | In-app + email to patient on status transitions (CONFIRMED / CANCELLED / COMPLETED / NO_SHOW / RESCHEDULED) |
| `sendAppointmentReminder({ appointment, hoursAhead })` | In-app + email reminder (hoursAhead: 24 or 2); called by cron job |

## When Notifications Fire

| Event | Who receives | Type |
|---|---|---|
| Patient books appointment | All staff (in-app + email) | `BOOKING_REQUEST` |
| Receptionist confirms booking | Patient (in-app + email) | `APPOINTMENT_CONFIRMED` |
| Receptionist creates appointment as CONFIRMED directly | Patient (in-app + email) | `APPOINTMENT_CONFIRMED` |
| Appointment cancelled | Patient (in-app + email) + Staff (in-app) | `APPOINTMENT_CANCELLED` |
| Appointment completed | Patient (in-app + email) | `APPOINTMENT_COMPLETED` |
| Appointment no-show | Patient (in-app + email) | `APPOINTMENT_NO_SHOW` |
| Appointment rescheduled | Patient (in-app + email) | `APPOINTMENT_RESCHEDULED` |
| 24h before appointment | Patient (in-app + email) | `REMINDER_24H` |
| 2h before appointment | Patient (in-app + email) | `REMINDER_2H` |

## `lib/email.js` Appointment Functions
- `sendAppointmentBookingEmail` — amber header, to staff
- `sendAppointmentConfirmedEmail` — green header, to patient
- `sendAppointmentCancelledEmail` — red header, to patient
- `sendAppointmentCompletedEmail` — blue header, to patient
- `sendAppointmentNoShowEmail` — slate header, to patient
- `sendAppointmentRescheduledEmail` — purple header, to patient
- `sendAppointmentReminderEmail` — cyan header, to patient; `hoursAhead` param (24 or 2)

All email functions are fire-and-forget (`.catch(() => {})`) — email failures never block the primary operation.

## Notification Bell (`components/commons/PageHeader.jsx`)
- `NotificationBell` polls `/api/notifications` every 30s for unread count
- Blue badge shows count; click opens `NotificationDrawer`
- `NotificationDrawer` uses Framer Motion `AnimatePresence` + `motion.div` spring slide-in from right (x: 100% → 0)
- Backdrop fades in behind drawer; click backdrop to close
- Per-notification mark-read on click; "Mark all read" button; relative time via `dayjs.fromNow()`

## Notification API Routes
- `GET /api/notifications` — last 50 notifications + `unreadCount` for session user
- `PATCH /api/notifications` — mark all as read for session user
- `PATCH /api/notifications/[id]` — mark single notification as read (owner check)

## Cron Job (Reminders)
- **File:** `app/api/cron/reminders/route.js`
- **Schedule:** every 15 minutes (`*/15 * * * *` in `vercel.json`)
- **Auth:** `Authorization: Bearer {CRON_SECRET}` header — set `CRON_SECRET` env var in Vercel + `.env`
- Finds CONFIRMED appointments in a ±30min window around 24h and 2h from now
- Sends in-app + email reminders; sets `reminderSent24h` / `reminderSent2h` = true to prevent duplicates
- Returns `{ sent24h, sent2h }` counts
