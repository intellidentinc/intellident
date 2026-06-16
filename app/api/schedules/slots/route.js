/**
 * GET /api/schedules/slots — PATIENT role only
 *
 * Key feature: Available time slot generation for the patient booking wizard.
 *
 * Algorithm:
 *   1. Validate date is a working day and not a clinic closure
 *   2. Generate candidate slots every 30 minutes from openTime to (closeTime - totalDuration)
 *      where totalDuration = sum of (service.duration + service.bufferTime) across all services
 *   3. If date is today, filter out slots within 30 minutes of now (same-day buffer)
 *   4. If dentistId is a specific ID: cross-check each slot against the dentist's
 *      existing non-cancelled appointments and remove conflicting ones
 *   5. If dentistId is 'ANY': return all future slots without conflict filtering —
 *      the receptionist assigns the dentist when confirming the PENDING booking
 *
 * Params: serviceIds (comma-separated), dentistId ('ANY' or specific ID), date (YYYY-MM-DD)
 */
import { NextResponse } from 'next/server'
import moment from 'moment-timezone'
import { getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET(request) {
  const user = await getAuthContext()
  if (!user || user.role !== ROLES.PATIENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const serviceIdsParam = searchParams.get('serviceIds') ?? searchParams.get('serviceId')
  const dentistId       = searchParams.get('dentistId')   // specific ID or 'ANY'
  const dateStr         = searchParams.get('date')         // YYYY-MM-DD

  if (!serviceIdsParam || !dentistId || !dateStr) {
    return NextResponse.json({ slots: [] })
  }

  const serviceIds = serviceIdsParam.split(',').filter(Boolean)

  const [services, schedule, closures] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds }, clinicId: user.clinicId, isDeleted: false },
    }),
    prisma.clinicSchedule.findUnique({ where: { clinicId: user.clinicId } }),
    prisma.clinicClosure.findMany({ where: { clinicId: user.clinicId } }),
  ])

  if (services.length === 0 || !schedule) return NextResponse.json({ slots: [] })

  // Validate date is a working day / not a closure (all in Asia/Manila)
  const targetManila = moment.tz(dateStr, 'Asia/Manila')
  const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  if (schedule.workingDays.length && !schedule.workingDays.includes(DAY_NAMES[targetManila.day()])) {
    return NextResponse.json({ slots: [] })
  }
  if (closures.some(c => moment(c.date).tz('Asia/Manila').format('YYYY-MM-DD') === dateStr)) {
    return NextResponse.json({ slots: [] })
  }

  // Parse open/close times in minutes
  const [openH, openM]   = schedule.openTime.split(':').map(Number)
  const [closeH, closeM] = schedule.closeTime.split(':').map(Number)
  const openMin  = openH * 60 + openM
  const closeMin = closeH * 60 + closeM
  const totalDuration = services.reduce((sum, s) => sum + s.duration + s.bufferTime, 0)

  // Generate candidate slots every 30 min
  const candidateSlots = []
  for (let m = openMin; m + totalDuration <= closeMin; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    candidateSlots.push({ time: `${hh}:${mm}`, minutes: m })
  }

  // Filter out past slots if date is today (in Asia/Manila)
  const nowManila = moment().tz('Asia/Manila')
  const isToday = nowManila.format('YYYY-MM-DD') === dateStr
  const nowMinutes = nowManila.hours() * 60 + nowManila.minutes()

  const futureSlots = isToday
    ? candidateSlots.filter(s => s.minutes > nowMinutes + 30) // 30 min buffer for same-day
    : candidateSlots

  if (futureSlots.length === 0) return NextResponse.json({ slots: [] })

  // For a specific dentist: filter out conflicted slots
  if (dentistId !== 'ANY') {
    const dayStart = targetManila.clone().startOf('day').toDate()
    const dayEnd   = targetManila.clone().endOf('day').toDate()

    const bookedAppts = await prisma.appointment.findMany({
      where: {
        dentistId,
        isDeleted: false,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, endsAt: true },
    })

    const availableSlots = futureSlots.filter(slot => {
      const slotStart = targetManila.clone().hours(Math.floor(slot.minutes / 60)).minutes(slot.minutes % 60).seconds(0).toDate()
      const slotEnd   = new Date(slotStart.getTime() + totalDuration * 60 * 1000)

      return !bookedAppts.some(appt => {
        const apptStart = new Date(appt.scheduledAt)
        const apptEnd   = new Date(appt.endsAt)
        return slotStart < apptEnd && slotEnd > apptStart
      })
    })

    return NextResponse.json({ slots: availableSlots.map(s => s.time) })
  }

  // For ANY: return all slots within operating hours (PENDING bookings are reviewed by receptionist)
  return NextResponse.json({ slots: futureSlots.map(s => s.time) })
}
