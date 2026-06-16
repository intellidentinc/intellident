import { NextResponse, after } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateJSON } from '@/lib/ai'
import dayjs from 'dayjs'

// Slot ranking is a lightweight task — use a fast model and never let it block the
// response for long; fall back to algorithmic tagging on timeout or error.
const AI_SLOTS_MODEL = 'gpt-5-mini'
const AI_SLOTS_TIMEOUT_MS = 4000

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), ms)),
  ])
}

// Deterministic fallback used when the model times out, errors, or returns nothing.
function algorithmicSuggestions(slots) {
  return slots.slice(0, 5).map((slot, i) => {
    const [h] = slot.split(':').map(Number)
    let tag = 'Flexible option'
    if (i === 0) tag = 'Earliest available'
    else if (h >= 9 && h < 11) tag = 'Best match'
    else if (h < 12) tag = 'Morning available'
    else tag = 'Afternoon available'
    return { time: slot, tag, reason: '' }
  })
}

// Generate time slots identical to /api/schedules/slots logic
function generateSlots(openTime, closeTime, totalDuration) {
  const slots = []
  const [openH, openM] = openTime.split(':').map(Number)
  const [closeH, closeM] = closeTime.split(':').map(Number)

  let current = openH * 60 + openM
  const limit = closeH * 60 + closeM - totalDuration

  while (current <= limit) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += 30
  }
  return slots
}

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const serviceId = searchParams.get('serviceId') ?? searchParams.get('serviceIds')?.split(',')[0]
  const dentistId = searchParams.get('dentistId')
  const dateStr = searchParams.get('date')

  if (!serviceId || !dentistId || !dateStr) {
    return NextResponse.json({ error: 'serviceId, dentistId, and date are required' }, { status: 400 })
  }

  const clinicId = session.clinicId

  const [service, clinicSchedule, closures] = await Promise.all([
    prisma.service.findFirst({
      where: { id: serviceId, clinicId, isDeleted: false },
      select: { name: true, duration: true, bufferTime: true },
    }),
    prisma.clinicSchedule.findUnique({ where: { clinicId } }),
    prisma.clinicClosure.findMany({
      where: { clinicId, date: { gte: new Date(dateStr + 'T00:00:00'), lte: new Date(dateStr + 'T23:59:59') } },
    }),
  ])

  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  if (!clinicSchedule) return NextResponse.json({ suggestions: [] })
  if (closures.length > 0) return NextResponse.json({ suggestions: [] })

  // Check working day
  const date = dayjs(dateStr)
  const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  if (!clinicSchedule.workingDays.includes(dayMap[date.day()])) {
    return NextResponse.json({ suggestions: [] })
  }

  const totalDuration = service.duration + (service.bufferTime ?? 0)
  let slots = generateSlots(clinicSchedule.openTime, clinicSchedule.closeTime, totalDuration)

  // Filter past slots if today
  if (date.isSame(dayjs(), 'day')) {
    const nowMinutes = dayjs().hour() * 60 + dayjs().minute() + 30
    slots = slots.filter((s) => {
      const [h, m] = s.split(':').map(Number)
      return h * 60 + m >= nowMinutes
    })
  }

  // Remove conflicting slots for specific dentist
  if (dentistId !== 'ANY') {
    const dayStart = new Date(dateStr + 'T00:00:00')
    const dayEnd = new Date(dateStr + 'T23:59:59')
    const existing = await prisma.appointment.findMany({
      where: {
        clinicId,
        dentistId,
        isDeleted: false,
        status: { notIn: ['CANCELLED'] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, endsAt: true },
    })

    slots = slots.filter((slot) => {
      const [h, m] = slot.split(':').map(Number)
      const slotStart = date.hour(h).minute(m).second(0)
      const slotEnd = slotStart.add(totalDuration, 'minute')
      return !existing.some((appt) => {
        const apptStart = dayjs(appt.scheduledAt)
        const apptEnd = dayjs(appt.endsAt)
        return slotStart.isBefore(apptEnd) && slotEnd.isAfter(apptStart)
      })
    })
  }

  if (slots.length === 0) return NextResponse.json({ suggestions: [] })

  // Use AI to rank and tag top 5 slots
  const prompt = `You are a scheduling assistant for a dental clinic. Given these available appointment slots for ${date.format('dddd, MMMM D, YYYY')}, select the best 3–5 slots and assign each a short explanation tag.

Available slots: ${slots.join(', ')}
Service: ${service.name} (${service.duration} min)

Rules:
- Tag options: "Earliest available", "Best match", "Lowest conflict risk", "Morning available", "Afternoon available", "Flexible option"
- Prefer mid-morning slots (9–11 AM) as "Best match" since patients generally prefer them
- "Earliest available" for the first slot of the day
- "Lowest conflict risk" for slots in less busy periods
- Return exactly this JSON object shape (no extra text):
{"slots":[{"time":"HH:MM","tag":"Tag text","reason":"One sentence explanation"}]}`

  let suggestions
  try {
    const raw = await withTimeout(generateJSON(prompt, AI_SLOTS_MODEL), AI_SLOTS_TIMEOUT_MS)
    // generateJSON uses json_object mode, so the model returns an object — accept
    // either a bare array or { slots | suggestions: [...] }.
    const arr = Array.isArray(raw) ? raw : (raw?.slots ?? raw?.suggestions ?? [])
    suggestions = (Array.isArray(arr) ? arr : [])
      .filter((s) => slots.includes(s.time))
      .slice(0, 5)
      .map((s) => ({ time: s.time, tag: s.tag ?? 'Available', reason: s.reason ?? '' }))
    if (suggestions.length === 0) suggestions = algorithmicSuggestions(slots)
  } catch {
    suggestions = algorithmicSuggestions(slots)
  }

  // Audit write doesn't need to block the response.
  after(
    prisma.auditLog
      .create({
        data: {
          userId: session.userId,
          clinicId,
          action: 'AI_INTERACTION',
          entity: 'SlotRecommendation',
          metadata: { serviceId, dentistId, date: dateStr, suggestionsCount: suggestions.length },
        },
      })
      .catch((err) => console.error('AI slots audit log failed:', err))
  )

  return NextResponse.json({ suggestions })
}
