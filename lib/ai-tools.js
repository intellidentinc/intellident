import { prisma } from '@/lib/prisma'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtAppointment(a) {
  return {
    code:    a.appointmentCode ?? a.id,
    date:    fmtDate(a.scheduledAt),
    time:    fmtTime(a.scheduledAt),
    patient: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—',
    service: a.service?.name ?? '—',
    dentist: a.dentist ? `Dr. ${a.dentist.user.firstName} ${a.dentist.user.lastName}` : 'Any available',
    status:  a.status,
    notes:   a.notes ?? null,
  }
}

function dayRange(dateStr) {
  const start = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

const APPOINTMENT_INCLUDE = {
  patient: { select: { firstName: true, lastName: true } },
  service: { select: { name: true } },
  dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
}

// ─── Tool declarations (OpenAI format) ───────────────────────────────────────

export const TOOLS_PATIENT = [
  {
    type: 'function',
    function: {
      name: 'get_my_appointments',
      description: "Get the current patient's own appointments. Use whenever the patient asks about their schedule, upcoming visits, past visits, or appointment status.",
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
  },
]

export const TOOLS_DENTIST = [
  {
    type: 'function',
    function: {
      name: 'get_my_schedule',
      description: "Get this dentist's appointment schedule for a specific date or today.",
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format. Omit for today.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_upcoming_appointments',
      description: "Get this dentist's upcoming appointments for the next 7 days.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_patients',
      description: 'Get the list of patients this dentist has had confirmed or completed appointments with.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
]

export const TOOLS_STAFF = [
  {
    type: 'function',
    function: {
      name: 'get_appointments_today',
      description: "Get all clinic appointments scheduled for today. Use when asked about today's schedule, how many patients today, who is coming in, etc.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_appointments',
      description: 'Get all PENDING booking requests waiting for confirmation.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
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
  },
  {
    type: 'function',
    function: {
      name: 'get_week_schedule',
      description: 'Get all appointments for the current week (today through 6 days ahead).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
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
  },
  {
    type: 'function',
    function: {
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
  },
  {
    type: 'function',
    function: {
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
  },
  {
    type: 'function',
    function: {
      name: 'get_dentist_list',
      description: 'Get the list of all dentists at this clinic.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
]

export function getToolsForRole(role) {
  if (role === 4) return TOOLS_PATIENT
  if (role === 2) return TOOLS_DENTIST
  if (role === 3 || role === 1 || role === 0) return TOOLS_STAFF
  return []
}

// ─── Tool executor ────────────────────────────────────────────────────────────

export function buildExecutor(session) {
  const { userId, clinicId, role } = session
  // Function-level authorization: build the allow-set from the caller's role.
  // The model is only ever handed role-filtered tools, but if it emits an
  // out-of-role tool call (prompt injection / hallucination), this rejects it
  // before any DB work. Missing role → getToolsForRole returns [] → all denied.
  const allowed = new Set(getToolsForRole(role).map((t) => t.function.name))

  return async function executeFunction(name, args) {
    if (!allowed.has(name)) return { error: 'Not authorized to use this tool.' }

    // ── Patient ──────────────────────────────────────────────────────────────
    if (name === 'get_my_appointments') {
      const patient = await prisma.patient.findFirst({ where: { userId, clinicId, isDeleted: false } })
      if (!patient) return { appointments: [], message: 'No patient profile found.' }

      const now = new Date()
      const statusMap = {
        upcoming:  { status: { in: ['PENDING', 'CONFIRMED'] }, scheduledAt: { gte: now } },
        pending:   { status: 'PENDING' },
        confirmed: { status: 'CONFIRMED' },
        past:      { scheduledAt: { lt: now } },
        all:       {},
      }
      const filter = args.filter ?? 'upcoming'
      const rows = await prisma.appointment.findMany({
        where: { patientId: patient.id, clinicId, isDeleted: false, ...(statusMap[filter] ?? statusMap.upcoming) },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: filter === 'past' ? 'desc' : 'asc' },
        take: 10,
      })
      return { appointments: rows.map(fmtAppointment), count: rows.length }
    }

    // ── Dentist ──────────────────────────────────────────────────────────────
    if (name === 'get_my_schedule') {
      const dentist = await prisma.dentist.findFirst({ where: { userId, clinicId, isDeleted: false } })
      if (!dentist) return { appointments: [], message: 'No dentist profile found.' }
      const { start, end } = dayRange(args.date)
      const rows = await prisma.appointment.findMany({
        where: { clinicId, dentistId: dentist.id, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: start, lte: end } },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
      })
      return { date: fmtDate(start), appointments: rows.map(fmtAppointment), count: rows.length }
    }

    if (name === 'get_my_upcoming_appointments') {
      const dentist = await prisma.dentist.findFirst({ where: { userId, clinicId, isDeleted: false } })
      if (!dentist) return { appointments: [] }
      const now = new Date()
      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
      const rows = await prisma.appointment.findMany({
        where: { clinicId, dentistId: dentist.id, isDeleted: false, status: { in: ['PENDING', 'CONFIRMED'] }, scheduledAt: { gte: now, lte: weekEnd } },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
        take: 20,
      })
      return { appointments: rows.map(fmtAppointment), count: rows.length }
    }

    if (name === 'get_my_patients') {
      const dentist = await prisma.dentist.findFirst({ where: { userId, clinicId, isDeleted: false } })
      if (!dentist) return { patients: [] }
      const rows = await prisma.appointment.findMany({
        where: { clinicId, dentistId: dentist.id, isDeleted: false, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        include: { patient: { select: { firstName: true, lastName: true, patientCode: true, phone: true } } },
        orderBy: { scheduledAt: 'desc' },
      })
      const seen = new Map()
      for (const a of rows) {
        const key = a.patient.patientCode ?? `${a.patient.firstName} ${a.patient.lastName}`
        if (!seen.has(key)) seen.set(key, a.patient)
      }
      return { patients: Array.from(seen.values()), count: seen.size }
    }

    // ── Staff ────────────────────────────────────────────────────────────────
    if (name === 'get_appointments_today') {
      const { start, end } = dayRange()
      const rows = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: start, lte: end } },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
      })
      return { date: fmtDate(start), appointments: rows.map(fmtAppointment), count: rows.length }
    }

    if (name === 'get_pending_appointments') {
      const rows = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: 'PENDING' },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
        take: 30,
      })
      return { appointments: rows.map(fmtAppointment), count: rows.length }
    }

    if (name === 'get_appointments_by_date') {
      const { start, end } = dayRange(args.date)
      const rows = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: start, lte: end } },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
      })
      return { date: fmtDate(start), appointments: rows.map(fmtAppointment), count: rows.length }
    }

    if (name === 'get_week_schedule') {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
      const rows = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: start, lte: end } },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
      })
      return { appointments: rows.map(fmtAppointment), count: rows.length }
    }

    if (name === 'get_patient_appointments') {
      const nameParts = (args.patient_name ?? '').trim().split(/\s+/)
      const patients = await prisma.patient.findMany({
        where: {
          clinicId, isDeleted: false,
          OR: nameParts.flatMap((p) => [
            { firstName: { contains: p, mode: 'insensitive' } },
            { lastName:  { contains: p, mode: 'insensitive' } },
          ]),
        },
        select: { id: true, firstName: true, lastName: true, patientCode: true },
        take: 5,
      })
      if (patients.length === 0) return { message: `No patient found matching "${args.patient_name}".` }
      const rows = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, patientId: { in: patients.map((p) => p.id) } },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'desc' },
        take: 15,
      })
      return {
        matched_patients: patients.map((p) => `${p.firstName} ${p.lastName} (${p.patientCode ?? 'no code'})`),
        appointments: rows.map(fmtAppointment),
        count: rows.length,
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
      const rows = await prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, dentistId: { in: dentists.map((d) => d.id) }, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: start, lte: end } },
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
      })
      return {
        dentist: dentists.map((d) => `Dr. ${d.user.firstName} ${d.user.lastName}`).join(', '),
        date: fmtDate(start),
        appointments: rows.map(fmtAppointment),
        count: rows.length,
      }
    }

    if (name === 'get_appointment_counts') {
      const { start, end } = dayRange(args.date)
      const base = { clinicId, isDeleted: false, scheduledAt: { gte: start, lte: end } }
      const [pending, confirmed, completed, noShow, total] = await Promise.all([
        prisma.appointment.count({ where: { ...base, status: 'PENDING' } }),
        prisma.appointment.count({ where: { ...base, status: 'CONFIRMED' } }),
        prisma.appointment.count({ where: { ...base, status: 'COMPLETED' } }),
        prisma.appointment.count({ where: { ...base, status: 'NO_SHOW' } }),
        prisma.appointment.count({ where: { ...base, status: { notIn: ['CANCELLED'] } } }),
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
          name:      `Dr. ${d.user.firstName} ${d.user.lastName}`,
          specialty: d.specialty ?? 'General',
          email:     d.user.email,
        })),
        count: dentists.length,
      }
    }

    return { error: `Unknown function: ${name}` }
  }
}
