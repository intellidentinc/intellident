import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAppointmentReminder } from '@/lib/notifications'

/**
 * GET /api/cron/reminders — Vercel Cron Job (every 15 minutes)
 *
 * Key features implemented here:
 *
 * 1. Bearer Token Auth
 *    Protected by CRON_SECRET env var. Only Vercel's cron runner (or a request
 *    with the correct Authorization header) can trigger this endpoint.
 *
 * 2. Idempotent Reminder Delivery
 *    Uses reminderSent24h / reminderSent2h boolean flags on the Appointment model.
 *    Each appointment only receives each reminder once, even if the cron fires
 *    multiple times within the ±30-minute detection window.
 *
 * 3. Dual-Channel Notification
 *    Each reminder sends both an in-app notification (bell) and a Gmail email
 *    via sendAppointmentReminder in lib/notifications.js.
 *
 * Detection windows (±30 min around each threshold):
 *   - 24h reminder: scheduledAt between (now + 23.5h) and (now + 24.5h)
 *   - 2h  reminder: scheduledAt between (now + 1.5h)  and (now + 2.5h)
 */
export async function GET(request) {
  // Protect the endpoint — only Vercel cron or requests with the correct secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // ── 24-hour window ───────────────────────────────────────────────────────────
  const window24Start = new Date(now.getTime() + 23.5 * 60 * 60 * 1000)
  const window24End   = new Date(now.getTime() + 24.5 * 60 * 60 * 1000)

  const due24h = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      isDeleted: false,
      reminderSent24h: false,
      scheduledAt: { gte: window24Start, lte: window24End },
    },
    include: {
      service: { select: { name: true } },
      patient: {
        include: {
          user: { select: { id: true, email: true, firstName: true } },
        },
      },
    },
  })

  // ── 2-hour window ────────────────────────────────────────────────────────────
  const window2Start = new Date(now.getTime() + 1.5 * 60 * 60 * 1000)
  const window2End   = new Date(now.getTime() + 2.5 * 60 * 60 * 1000)

  const due2h = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      isDeleted: false,
      reminderSent2h: false,
      scheduledAt: { gte: window2Start, lte: window2End },
    },
    include: {
      service: { select: { name: true } },
      patient: {
        include: {
          user: { select: { id: true, email: true, firstName: true } },
        },
      },
    },
  })

  // Process 24h reminders
  for (const appt of due24h) {
    await sendAppointmentReminder({ appointment: appt, hoursAhead: 24 })
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reminderSent24h: true },
    })
  }

  // Process 2h reminders
  for (const appt of due2h) {
    await sendAppointmentReminder({ appointment: appt, hoursAhead: 2 })
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reminderSent2h: true },
    })
  }

  return NextResponse.json({
    sent24h: due24h.length,
    sent2h: due2h.length,
  })
}
