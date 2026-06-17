import { NextResponse, after } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateJSON } from '@/lib/ai'
import { computeAvailableSlots } from '@/lib/slots'
import moment from 'moment-timezone'

// Slot ranking is a lightweight task — use a fast model and never let it block the
// response for long; fall back to algorithmic tagging on timeout or error.
const AI_SLOTS_MODEL = 'gpt-5-mini'
// gpt-5-mini (a reasoning model) takes ~3s locally; on Vercel a cold start + network
// latency regularly pushes it past 4s, which silently dropped every request to the
// algorithmic fallback (generic tags, no reasons). 15s gives real headroom — the
// Vercel function ceiling is far higher (300s).
const AI_SLOTS_TIMEOUT_MS = 15000

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

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const serviceIdsParam = searchParams.get('serviceIds') ?? searchParams.get('serviceId')
  const dentistId = searchParams.get('dentistId')
  const dateStr = searchParams.get('date')

  if (!serviceIdsParam || !dentistId || !dateStr) {
    return NextResponse.json({ error: 'serviceIds, dentistId, and date are required' }, { status: 400 })
  }

  const clinicId = session.clinicId
  const serviceIds = serviceIdsParam.split(',').filter(Boolean)

  // Fetch service(s) for the prompt context, and compute the available slots using
  // the SAME logic as /api/schedules/slots so the AI ranks exactly what the patient sees.
  const [services, slots] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds }, clinicId, isDeleted: false },
      select: { name: true, duration: true },
    }),
    computeAvailableSlots({ clinicId, serviceIds, dentistId, dateStr }),
  ])

  if (services.length === 0) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  if (slots.length === 0) return NextResponse.json({ suggestions: [] })

  const date = moment.tz(dateStr, 'Asia/Manila')
  const serviceName = services.map((s) => s.name).join(' + ')
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)

  // Use AI to rank and tag top 5 slots
  const prompt = `You are a scheduling assistant for a dental clinic. Given these available appointment slots for ${date.format('dddd, MMMM D, YYYY')}, select the best 3–5 slots and assign each a short explanation tag.

Available slots: ${slots.join(', ')}
Service: ${serviceName} (${totalDuration} min)

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
          metadata: { serviceIds, dentistId, date: dateStr, suggestionsCount: suggestions.length },
        },
      })
      .catch((err) => console.error('AI slots audit log failed:', err))
  )

  return NextResponse.json({ suggestions })
}
