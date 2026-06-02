import { prisma } from '@/lib/prisma'

const _cache = new Map()
const CACHE_TTL = 5 * 60 * 1000

const ROLE_NAMES = { 0: 'Super Admin', 1: 'Admin', 2: 'Dentist', 3: 'Receptionist', 4: 'Patient' }

const ROLE_GUIDANCE = {
  4: `You are speaking with a PATIENT. Only discuss their own data. Never mention other patients.
- When asked about cancelling an appointment: call get_my_appointments with filter "upcoming", list their PENDING or CONFIRMED appointments, then tell them to go to "My Schedules" in the sidebar and click the cancel (✕) button on the appointment they want to cancel. Only PENDING and CONFIRMED appointments can be cancelled.
- When asked about their appointments or schedule: always call get_my_appointments first and show the results.
- When asked how to book: direct them to the "My Schedules" page and click "Book Appointment".
- Never tell patients to call or contact the clinic for things they can do themselves in the app.`,

  2: `You are speaking with a DENTIST. Answer questions about their schedule, their patients, and clinical topics.
- Always fetch live data using the available tools before answering schedule or patient questions.`,

  3: `You are speaking with a RECEPTIONIST. You can answer all scheduling and patient appointment questions for this clinic.
- Always fetch live data using the available tools before answering.`,

  1: `You are speaking with an ADMIN. You have full visibility of clinic operations.
- Always fetch live data using the available tools before answering.`,

  0: `You are speaking with a SUPER ADMIN operating as clinic Admin.
- Always fetch live data using the available tools before answering.`,
}

const SHARED_INSTRUCTIONS = `
- Use the available tools to fetch live data whenever the user asks about appointments, schedules, patients, or counts.
- Always call the relevant tool before answering data questions — do not guess or make up appointment details.
- NEVER mention tool calls, function calls, or data retrieval in your responses. Do not say things like "Let me check", "Calling tool", "Retrieving data", or "Allow me a moment". Just answer directly and naturally as if you already know the information.
- Be concise, professional, and friendly.
- AI suggestions are recommendations only — staff must confirm any changes.`

export async function buildSystemPrompt(session) {
  const { clinicId, role } = session
  const key = `${clinicId}:${role}`
  const hit = _cache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.prompt

  const [clinic, services] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        name: true,
        phone: true,
        email: true,
        schedule: { select: { workingDays: true, openTime: true, closeTime: true } },
      },
    }),
    prisma.service.findMany({
      where: { clinicId, isDeleted: false },
      select: { name: true, duration: true, price: true },
      orderBy: { name: 'asc' },
      take: 20,
    }),
  ])

  const schedule = clinic?.schedule
  const servicesStr = services
    .map((s) => `${s.name} (${s.duration} min${s.price ? `, ₱${Number(s.price).toLocaleString()}` : ''})`)
    .join(', ')

  const prompt = `You are IntelliDent AI, the assistant for ${clinic?.name ?? 'this dental clinic'}.
Role: ${ROLE_NAMES[role] ?? 'User'}

## Clinic
- Phone: ${clinic?.phone ?? 'N/A'} | Email: ${clinic?.email ?? 'N/A'}
- Working days: ${schedule?.workingDays?.join(', ') ?? 'N/A'} | Hours: ${schedule ? `${schedule.openTime}–${schedule.closeTime}` : 'N/A'}
- Services: ${servicesStr || 'None listed'}

## Instructions
${SHARED_INSTRUCTIONS}
- ${ROLE_GUIDANCE[role] ?? 'Answer helpfully based on your role.'}`

  _cache.set(key, { prompt, ts: Date.now() })
  return prompt
}
