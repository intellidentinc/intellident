import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAppointmentReminder } from '@/lib/notifications'

/**
 * GET /api/cron/reminders — Vercel Cron Job (every 15 minutes)
 *
 * Per-clinic reminder intervals: reads reminder1Hours / reminder2Hours from each
 * Clinic record (defaults: 24h / 2h). Respects notifConfig per-type toggles.
 * Idempotency: reminderSent24h / reminderSent2h flags prevent duplicate sends.
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const clinics = await prisma.clinic.findMany({
    where: { isDeleted: false, isEnabled: true },
    select: { id: true, reminder1Hours: true, reminder2Hours: true, notifConfig: true },
  })

  let sent1 = 0
  let sent2 = 0

  for (const clinic of clinics) {
    const h1 = clinic.reminder1Hours ?? 24
    const h2 = clinic.reminder2Hours ?? 2
    const half = 0.5 * 60 * 60 * 1000

    // ── First reminder window ────────────────────────────────────────────────
    const w1Start = new Date(now.getTime() + h1 * 60 * 60 * 1000 - half)
    const w1End   = new Date(now.getTime() + h1 * 60 * 60 * 1000 + half)

    const due1 = await prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        status: 'CONFIRMED',
        isDeleted: false,
        reminderSent24h: false,
        scheduledAt: { gte: w1Start, lte: w1End },
      },
      include: {
        service: { select: { name: true } },
        patient: { include: { user: { select: { id: true, email: true, firstName: true } } } },
      },
    })

    for (const appt of due1) {
      await sendAppointmentReminder({ appointment: appt, hoursAhead: h1, notifConfig: clinic.notifConfig })
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSent24h: true } })
      sent1++
    }

    // ── Second reminder window ───────────────────────────────────────────────
    const w2Start = new Date(now.getTime() + h2 * 60 * 60 * 1000 - half)
    const w2End   = new Date(now.getTime() + h2 * 60 * 60 * 1000 + half)

    const due2 = await prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        status: 'CONFIRMED',
        isDeleted: false,
        reminderSent2h: false,
        scheduledAt: { gte: w2Start, lte: w2End },
      },
      include: {
        service: { select: { name: true } },
        patient: { include: { user: { select: { id: true, email: true, firstName: true } } } },
      },
    })

    for (const appt of due2) {
      await sendAppointmentReminder({ appointment: appt, hoursAhead: h2, notifConfig: clinic.notifConfig })
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSent2h: true } })
      sent2++
    }
  }

  return NextResponse.json({ sent1, sent2 })
}
