import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAppointmentReminder } from '@/lib/notifications'

/**
 * Cron: runs every 15 minutes via Vercel Cron.
 * Sends 24h and 2h reminders for upcoming CONFIRMED appointments.
 * Uses reminderSent24h / reminderSent2h flags to prevent duplicates.
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
