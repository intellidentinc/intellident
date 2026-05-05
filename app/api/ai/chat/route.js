import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatWithTools } from '@/lib/gemini'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function fmtAppt(a) {
  const dentist = a.dentist ? `Dr. ${a.dentist.user.firstName} ${a.dentist.user.lastName}` : 'Any available'
  const patient = a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—'
  return {
    code: a.appointmentCode ?? a.id,
    date: fmtDate(a.scheduledAt),
    time: fmtTime(a.scheduledAt),
    patient,
    service: a.service?.name ?? '—',
    dentist,
    status: a.status,
    notes: a.notes ?? null,
  }
}

function dayRange(dateStr) {
  const start = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS_PATIENT = [
  {
    name: 'get_my_appointments',
    description: 'Get the current patient\'s own appointments. Use this whenever the patient asks about their schedule, upcoming visits, past visits, or appointment status.',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['upcoming', 'past', 'pending', 'confirmed', 'all'],
          description: 'Filter appointments. Defaults to "upcoming".',
        },
      },
      required: [],
    },
  },
]

const TOOLS_DENTIST = [
  {
    name: 'get_my_schedule',
    description: 'Get this dentist\'s appointment schedule for a specific date or today.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Omit for today.' },
      },
      required: [],
    },
  },
  {
    name: 'get_my_upcoming_appointments',
    description: 'Get this dentist\'s upcoming appointments for the next 7 days.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_my_patients',
    description: 'Get the list of patients this dentist has had confirmed or completed appointments with.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
]

const TOOLS_STAFF = [
  {
    name: 'get_appointments_today',
    description: 'Get all clinic appointments scheduled for today. Use this when asked about today\'s schedule, how many patients today, who is coming in, etc.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_pending_appointments',
    description: 'Get all PENDING booking requests waiting for confirmation.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_appointments_by_date',
    description: 'Get all appointments for a specific date.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_week_schedule',
    description: 'Get all appointments for the current week (today through 6 days ahead).',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_patient_appointments',
    description: 'Search for a patient by name and return their appointments.',
    parameters: {
      type: 'object',
      properties: {
        patient_name: { type: 'string', description: 'Full or partial patient name to search.' },
      },
      required: ['patient_name'],
    },
  },
  {
    name: 'get_dentist_schedule',
    description: 'Get appointments for a specific dentist, optionally filtered by date.',
    parameters: {
      type: 'object',
      properties: {
        dentist_name: { type: 'string', description: 'Full or partial dentist name.' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Omit for today.' },
      },
      required: ['dentist_name'],
    },
  },
  {
    name: 'get_appointment_counts',
    description: 'Get appointment counts grouped by status for today or a specific date.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Omit for today.' },
      },
      required: [],
    },
  },
  {
    name: 'get_dentist_list',
    description: 'Get the list of all dentists at this clinic.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
]

function getToolsForRole(role) {
  if (role === 4) return TOOLS_PATIENT
  if (role === 2) return TOOLS_DENTIST
  if (role === 3 || role === 1 || role === 0) return TOOLS_STAFF
  return []
}

// ─── Tool executor ────────────────────────────────────────────────────────────

function buildExecutor(session) {
  const { userId, clinicId, role } = session

  return async function executeFunction(name, args) {
    // ── Patient tools ──────────────────────────────────────────────────────
    if (name === 'get_my_appointments') {
      const patient = await prisma.patient.findFirst({
        where: { userId, clinicId, isDeleted: false },
      })
      if (!patient) return { appointments: [], message: 'No patient profile found.' }

      const filter = args.filter ?? 'upcoming'
      const now = new Date()

      const statusMap = {
        upcoming:  { status: { in: ['PENDING', 'CONFIRMED'] }, scheduledAt: { gte: now } },
        pending:   { status: 'PENDING' },
        confirmed: { status: 'CONFIRMED' },
        past:      { scheduledAt: { lt: now } },
        all:       {},
      }

      const where = {
        patientId: patient.id,
        clinicId,
        isDeleted: false,
        ...(statusMap[filter] ?? statusMap.upcoming),
      }

      const appts = await prisma.appointment.findMany({
        where,
        include: {
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: filter === 'past' ? 'desc' : 'asc' },
        take: 10,
      })

      return { appointments: appts.map(fmtAppt), count: appts.length }
    }

    // ── Dentist tools ──────────────────────────────────────────────────────
    if (name === 'get_my_schedule') {
      const dentist = await prisma.dentist.findFirst({ where: { userId, clinicId, isDeleted: false } })
      if (!dentist) return { appointments: [], message: 'No dentist profile found.' }

      const { start, end } = dayRange(args.date)
      const appts = await prisma.appointment.findMany({
        where: {
          clinicId, dentistId: dentist.id, isDeleted: false,
          status: { notIn: ['CANCELLED'] },
          scheduledAt: { gte: start, lte: end },
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
      })

      return {
        date: fmtDate(start),
        appointments: appts.map(fmtAppt),
        count: appts.length,
      }
    }

    if (name === 'get_my_upcoming_appointments') {
      const dentist = await prisma.dentist.findFirst({ where: { userId, clinicId, isDeleted: false } })
      if (!dentist) return { appointments: [] }

      const now = new Date()
      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
      const appts = await prisma.appointment.findMany({
        where: {
          clinicId, dentistId: dentist.id, isDeleted: false,
          status: { in: ['PENDING', 'CONFIRMED'] },
          scheduledAt: { gte: now, lte: weekEnd },
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 20,
      })

      return { appointments: appts.map(fmtAppt), count: appts.length }
    }

    if (name === 'get_my_patients') {
      const dentist = await prisma.dentist.findFirst({ where: { userId, clinicId, isDeleted: false } })
      if (!dentist) return { patients: [] }

      const appts = await prisma.appointment.findMany({
        where: {
          clinicId, dentistId: dentist.id, isDeleted: false,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
        include: { patient: { select: { firstName: true, lastName: true, patientCode: true, phone: true } } },
        orderBy: { scheduledAt: 'desc' },
      })

      const seen = new Map()
      for (const a of appts) {
        const key = a.patient.patientCode ?? `${a.patient.firstName} ${a.patient.lastName}`
        if (!seen.has(key)) seen.set(key, a.patient)
      }

      return { patients: Array.from(seen.values()), count: seen.size }
    }

    // ── Staff tools ────────────────────────────────────────────────────────
    if (name === 'get_appointments_today') {
      const { start, end } = dayRange()
      const appts = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: start, lte: end } },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
      })
      return { date: fmtDate(start), appointments: appts.map(fmtAppt), count: appts.length }
    }

    if (name === 'get_pending_appointments') {
      const appts = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: 'PENDING' },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 30,
      })
      return { appointments: appts.map(fmtAppt), count: appts.length }
    }

    if (name === 'get_appointments_by_date') {
      const { start, end } = dayRange(args.date)
      const appts = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: start, lte: end } },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
      })
      return { date: fmtDate(start), appointments: appts.map(fmtAppt), count: appts.length }
    }

    if (name === 'get_week_schedule') {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
      const appts = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: start, lte: end } },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
      })
      return { appointments: appts.map(fmtAppt), count: appts.length }
    }

    if (name === 'get_patient_appointments') {
      const nameParts = (args.patient_name ?? '').trim().split(/\s+/)
      const patients = await prisma.patient.findMany({
        where: {
          clinicId,
          isDeleted: false,
          OR: nameParts.flatMap((p) => [
            { firstName: { contains: p, mode: 'insensitive' } },
            { lastName:  { contains: p, mode: 'insensitive' } },
          ]),
        },
        select: { id: true, firstName: true, lastName: true, patientCode: true },
        take: 5,
      })

      if (patients.length === 0) return { message: `No patient found matching "${args.patient_name}".` }

      const appts = await prisma.appointment.findMany({
        where: {
          clinicId, isDeleted: false,
          patientId: { in: patients.map((p) => p.id) },
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 15,
      })

      return {
        matched_patients: patients.map((p) => `${p.firstName} ${p.lastName} (${p.patientCode ?? 'no code'})`),
        appointments: appts.map(fmtAppt),
        count: appts.length,
      }
    }

    if (name === 'get_dentist_schedule') {
      const nameParts = (args.dentist_name ?? '').trim().split(/\s+/)
      const dentists = await prisma.dentist.findMany({
        where: {
          clinicId, isDeleted: false,
          user: {
            OR: nameParts.flatMap((p) => [
              { firstName: { contains: p, mode: 'insensitive' } },
              { lastName:  { contains: p, mode: 'insensitive' } },
            ]),
          },
        },
        include: { user: { select: { firstName: true, lastName: true } } },
        take: 3,
      })

      if (dentists.length === 0) return { message: `No dentist found matching "${args.dentist_name}".` }

      const { start, end } = dayRange(args.date)
      const appts = await prisma.appointment.findMany({
        where: {
          clinicId, isDeleted: false,
          dentistId: { in: dentists.map((d) => d.id) },
          status: { notIn: ['CANCELLED'] },
          scheduledAt: { gte: start, lte: end },
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
      })

      return {
        dentist: dentists.map((d) => `Dr. ${d.user.firstName} ${d.user.lastName}`).join(', '),
        date: fmtDate(start),
        appointments: appts.map(fmtAppt),
        count: appts.length,
      }
    }

    if (name === 'get_appointment_counts') {
      const { start, end } = dayRange(args.date)
      const [pending, confirmed, completed, noShow, total] = await Promise.all([
        prisma.appointment.count({ where: { clinicId, isDeleted: false, status: 'PENDING',   scheduledAt: { gte: start, lte: end } } }),
        prisma.appointment.count({ where: { clinicId, isDeleted: false, status: 'CONFIRMED', scheduledAt: { gte: start, lte: end } } }),
        prisma.appointment.count({ where: { clinicId, isDeleted: false, status: 'COMPLETED', scheduledAt: { gte: start, lte: end } } }),
        prisma.appointment.count({ where: { clinicId, isDeleted: false, status: 'NO_SHOW',   scheduledAt: { gte: start, lte: end } } }),
        prisma.appointment.count({ where: { clinicId, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: start, lte: end } } }),
      ])
      return { date: fmtDate(start), total, pending, confirmed, completed, no_show: noShow }
    }

    if (name === 'get_dentist_list') {
      const dentists = await prisma.dentist.findMany({
        where: { clinicId, isDeleted: false },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      })
      return {
        dentists: dentists.map((d) => ({
          name: `Dr. ${d.user.firstName} ${d.user.lastName}`,
          specialty: d.specialty ?? 'General',
          email: d.user.email,
        })),
        count: dentists.length,
      }
    }

    return { error: `Unknown function: ${name}` }
  }
}

// ─── System prompt (lean — tools handle data) ─────────────────────────────────

async function buildSystemPrompt(session) {
  const { clinicId, role } = session

  const [clinic, services] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        name: true, phone: true, email: true,
        schedule: { select: { workingDays: true, openTime: true, closeTime: true } },
      },
    }),
    prisma.service.findMany({
      where: { clinicId, isDeleted: false },
      select: { name: true, duration: true, price: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const roleNames = { 0: 'Super Admin', 1: 'Admin', 2: 'Dentist', 3: 'Receptionist', 4: 'Patient' }
  const sched = clinic?.schedule
  const servicesStr = services
    .map((s) => `${s.name} (${s.duration} min${s.price ? `, ₱${Number(s.price).toLocaleString()}` : ''})`)
    .join(', ')

  const roleGuidance = {
    4: `You are speaking with a PATIENT. Only discuss their own data. Never mention other patients.
- When asked about cancelling an appointment: call get_my_appointments with filter "upcoming", list their PENDING or CONFIRMED appointments, then tell them to go to "My Schedules" in the sidebar and click the cancel (✕) button on the appointment they want to cancel. Only PENDING and CONFIRMED appointments can be cancelled.
- When asked about their appointments or schedule: always call get_my_appointments first and show the results.
- When asked how to book: direct them to the "My Schedules" page and click "Book Appointment".
- Never tell patients to call or contact the clinic for things they can do themselves in the app.`,
    2: 'You are speaking with a DENTIST. Answer questions about their schedule, their patients, and clinical topics. Always fetch live data using the available tools before answering schedule or patient questions.',
    3: 'You are speaking with a RECEPTIONIST. You can answer all scheduling and patient appointment questions for this clinic. Always fetch live data using the available tools before answering.',
    1: 'You are speaking with an ADMIN. You have full visibility of clinic operations. Always fetch live data using the available tools before answering.',
    0: 'You are speaking with a SUPER ADMIN operating as clinic Admin. Always fetch live data using the available tools before answering.',
  }

  return `You are IntelliDent AI, the assistant for ${clinic?.name ?? 'this dental clinic'}.
Role: ${roleNames[role] ?? 'User'}

## Clinic
- Phone: ${clinic?.phone ?? 'N/A'} | Email: ${clinic?.email ?? 'N/A'}
- Working days: ${sched?.workingDays?.join(', ') ?? 'N/A'} | Hours: ${sched ? `${sched.openTime}–${sched.closeTime}` : 'N/A'}
- Services: ${servicesStr || 'None listed'}

## Instructions
- Use the available tools to fetch live data whenever the user asks about appointments, schedules, patients, or counts.
- Always call the relevant tool before answering data questions — do not guess or make up appointment details.
- NEVER mention tool calls, function calls, or data retrieval in your responses. Do not say things like "Let me check", "Calling tool", "Retrieving data", or "Allow me a moment". Just answer directly and naturally as if you already know the information.
- Be concise, professional, and friendly.
- ${roleGuidance[role] ?? 'Answer helpfully based on your role.'}
- AI suggestions are recommendations only — staff must confirm any changes.`
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await prisma.chatSession.findMany({
    where: { userId: session.userId, clinicId: session.clinicId, isDeleted: false },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json({ sessions })
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { message, sessionId } = body
  if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  // Get or create chat session
  let chatSession
  if (sessionId) {
    chatSession = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: session.userId, clinicId: session.clinicId, isDeleted: false },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!chatSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  } else {
    chatSession = await prisma.chatSession.create({
      data: { userId: session.userId, clinicId: session.clinicId, title: message.slice(0, 80) },
      include: { messages: true },
    })
  }

  const [systemPrompt, tools] = await Promise.all([
    buildSystemPrompt(session),
    Promise.resolve(getToolsForRole(session.role)),
  ])

  let aiText
  try {
    aiText = await chatWithTools(
      systemPrompt,
      chatSession.messages,
      message.trim(),
      tools,
      buildExecutor(session),
    )
    // Strip any leaked tool-call narration Gemini occasionally adds
    aiText = aiText
      .replace(/calling tool[^\n.]*/gi, '')
      .replace(/retrieving (data|information)[^\n.]*/gi, '')
      .replace(/allow me a moment[^\n.]*/gi, '')
      .replace(/let me (check|fetch|retrieve|look up)[^\n.]*/gi, '')
      .replace(/^\s*[\r\n]/gm, '\n')
      .trim()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'AI service unavailable. Please try again.', detail }, { status: 503 })
  }

  await prisma.chatMessage.createMany({
    data: [
      { sessionId: chatSession.id, role: 'USER',      content: message.trim() },
      { sessionId: chatSession.id, role: 'ASSISTANT', content: aiText },
    ],
  })

  await prisma.chatSession.update({
    where: { id: chatSession.id },
    data: { updatedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      clinicId: session.clinicId,
      action: 'AI_INTERACTION',
      entity: 'ChatSession',
      entityId: chatSession.id,
      metadata: { messageLength: message.trim().length, toolsAvailable: tools.map((t) => t.name) },
    },
  })

  return NextResponse.json({ sessionId: chatSession.id, message: { role: 'ASSISTANT', content: aiText } })
}
