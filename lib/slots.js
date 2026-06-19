/**
 * Shared available-slot computation for the patient booking flow.
 *
 * Used by both:
 *   - GET /api/schedules/slots   — populates the visible slot list
 *   - GET /api/ai/slots          — ranks/tags the same slots
 *
 * Keeping a single source of truth prevents the two endpoints from drifting
 * (they previously diverged on timezone handling and NO_SHOW conflict rules,
 * which made "AI Pick" return nothing while slots were visible).
 *
 * All date math is in Asia/Manila via moment-timezone.
 *
 * Returns an array of 'HH:MM' strings (the clinic-local start times still
 * available for the given service(s) + dentist on the given date), or [] when
 * the date is closed / not a working day / fully booked / inputs are invalid.
 */
import moment from 'moment-timezone'
import { prisma } from '@/lib/prisma'

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const TZ = 'Asia/Manila'

/**
 * @param {object} args
 * @param {string} args.clinicId
 * @param {string[]} args.serviceIds
 * @param {string} args.dentistId  - a specific Dentist id, or 'ANY'
 * @param {string} args.dateStr    - 'YYYY-MM-DD'
 * @returns {Promise<string[]>}    - available 'HH:MM' start times
 */
export async function computeAvailableSlots({ clinicId, serviceIds, dentistId, dateStr }) {
  if (!clinicId || !serviceIds?.length || !dentistId || !dateStr) return []

  const [services, schedule, closures] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds }, clinicId, isDeleted: false },
    }),
    prisma.clinicSchedule.findUnique({ where: { clinicId } }),
    prisma.clinicClosure.findMany({ where: { clinicId } }),
  ])

  if (services.length === 0 || !schedule) return []

  // Validate date is a working day / not a closure (all in Asia/Manila)
  const targetManila = moment.tz(dateStr, 'YYYY-MM-DD', TZ)
  if (!targetManila.isValid()) return []
  if (schedule.workingDays.length && !schedule.workingDays.includes(DAY_NAMES[targetManila.day()])) {
    return []
  }
  if (closures.some((c) => moment(c.date).tz(TZ).format('YYYY-MM-DD') === dateStr)) {
    return []
  }

  // Parse open/close times in minutes
  const [openH, openM] = schedule.openTime.split(':').map(Number)
  const [closeH, closeM] = schedule.closeTime.split(':').map(Number)
  const openMin = openH * 60 + openM
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
  const nowManila = moment().tz(TZ)
  const isToday = nowManila.format('YYYY-MM-DD') === dateStr
  const nowMinutes = nowManila.hours() * 60 + nowManila.minutes()

  const futureSlots = isToday
    ? candidateSlots.filter((s) => s.minutes > nowMinutes + 30) // 30 min buffer for same-day
    : candidateSlots

  if (futureSlots.length === 0) return []

  // 'ANY': return all slots within operating hours (receptionist assigns dentist on confirm)
  if (dentistId === 'ANY') return futureSlots.map((s) => s.time)

  // Specific dentist: filter out conflicted slots
  const dayStart = targetManila.clone().startOf('day').toDate()
  const dayEnd = targetManila.clone().endOf('day').toDate()

  const bookedAppts = await prisma.appointment.findMany({
    where: {
      dentistId,
      isDeleted: false,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      scheduledAt: { gte: dayStart, lte: dayEnd },
    },
    select: { scheduledAt: true, endsAt: true },
  })

  const availableSlots = futureSlots.filter((slot) => {
    const slotStart = targetManila
      .clone()
      .hours(Math.floor(slot.minutes / 60))
      .minutes(slot.minutes % 60)
      .seconds(0)
      .toDate()
    const slotEnd = new Date(slotStart.getTime() + totalDuration * 60 * 1000)

    return !bookedAppts.some((appt) => {
      const apptStart = new Date(appt.scheduledAt)
      const apptEnd = new Date(appt.endsAt)
      return slotStart < apptEnd && slotEnd > apptStart
    })
  })

  return availableSlots.map((s) => s.time)
}
