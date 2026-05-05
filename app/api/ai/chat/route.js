import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatWithHistory } from '@/lib/gemini'

async function buildSystemPrompt(session) {
  const { userId, clinicId, role } = session

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
    }),
  ])

  const roleNames = { 0: 'Super Admin', 1: 'Admin', 2: 'Dentist', 3: 'Receptionist', 4: 'Patient' }
  const roleName = roleNames[role] ?? 'User'

  const sched = clinic?.schedule
  const hoursStr = sched ? `${sched.openTime}–${sched.closeTime}` : 'not configured'
  const daysStr = sched?.workingDays?.join(', ') ?? 'not configured'
  const servicesStr = services
    .map((s) => `${s.name} (${s.duration} min${s.price ? `, ₱${Number(s.price).toLocaleString()}` : ''})`)
    .join('\n- ')

  let roleContext = ''

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
  const weekEnd    = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59, 999)

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  function fmtTime(d) {
    return new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  function fmtAppt(a) {
    const dentistName = a.dentist ? `Dr. ${a.dentist.user.firstName} ${a.dentist.user.lastName}` : 'Any available dentist'
    const patient = a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Unknown patient'
    return `- [${a.appointmentCode ?? a.id}] ${fmtDate(a.scheduledAt)} ${fmtTime(a.scheduledAt)} | Patient: ${patient} | Service: ${a.service.name} | Dentist: ${dentistName} | Status: ${a.status}`
  }

  if (role === 4) {
    // PATIENT — inject their own upcoming appointments only
    const patient = await prisma.patient.findFirst({
      where: { userId, clinicId, isDeleted: false },
    })
    if (patient) {
      const upcoming = await prisma.appointment.findMany({
        where: {
          patientId: patient.id,
          clinicId,
          isDeleted: false,
          status: { in: ['PENDING', 'CONFIRMED'] },
          scheduledAt: { gte: new Date() },
        },
        include: {
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      })
      roleContext = upcoming.length > 0
        ? `\n## Your Upcoming Appointments\n` + upcoming.map((a) =>
            `- ${a.appointmentCode ?? a.id}: ${a.service.name} on ${fmtDate(a.scheduledAt)} at ${fmtTime(a.scheduledAt)} — Status: ${a.status}${a.dentist ? ` with Dr. ${a.dentist.user.firstName} ${a.dentist.user.lastName}` : ''}`
          ).join('\n')
        : `\n## Your Upcoming Appointments\nNo upcoming appointments.`
    }

  } else if (role === 2) {
    // DENTIST — inject their own today + this week schedule
    const dentist = await prisma.dentist.findFirst({
      where: { userId, clinicId, isDeleted: false },
    })
    if (dentist) {
      const [todayAppts, weekAppts, pendingCount] = await Promise.all([
        prisma.appointment.findMany({
          where: { clinicId, dentistId: dentist.id, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: todayStart, lte: todayEnd } },
          include: { patient: { select: { firstName: true, lastName: true } }, service: { select: { name: true } } },
          orderBy: { scheduledAt: 'asc' },
        }),
        prisma.appointment.findMany({
          where: { clinicId, dentistId: dentist.id, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: todayStart, lte: weekEnd } },
          include: { patient: { select: { firstName: true, lastName: true } }, service: { select: { name: true } }, dentist: { include: { user: { select: { firstName: true, lastName: true } } } } },
          orderBy: { scheduledAt: 'asc' },
          take: 20,
        }),
        prisma.appointment.count({ where: { clinicId, isDeleted: false, status: 'PENDING' } }),
      ])

      roleContext = `
## Your Schedule — Today (${fmtDate(todayStart)})
Total appointments today: ${todayAppts.length}
${todayAppts.length === 0 ? 'No appointments scheduled for today.' : todayAppts.map((a) => `- ${fmtTime(a.scheduledAt)} | ${a.patient.firstName} ${a.patient.lastName} | ${a.service.name} | Status: ${a.status}`).join('\n')}

## Your Schedule — This Week
Total this week: ${weekAppts.length}
${weekAppts.map((a) => `- ${fmtDate(a.scheduledAt)} ${fmtTime(a.scheduledAt)} | ${a.patient.firstName} ${a.patient.lastName} | ${a.service.name} | Status: ${a.status}`).join('\n') || 'No appointments this week.'}

## Clinic Overview
Pending booking requests: ${pendingCount}`

    }

  } else if (role === 3 || role === 1 || role === 0) {
    // RECEPTIONIST / ADMIN / SUPERADMIN — full clinic appointment view
    const [todayAppts, pendingAppts, weekCount, allDentists] = await Promise.all([
      prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: todayStart, lte: todayEnd } },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.appointment.findMany({
        where: { clinicId, isDeleted: false, status: 'PENDING' },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
          dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 20,
      }),
      prisma.appointment.count({
        where: { clinicId, isDeleted: false, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: todayStart, lte: weekEnd } },
      }),
      prisma.dentist.findMany({
        where: { clinicId, isDeleted: false },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
    ])

    const confirmedToday   = todayAppts.filter(a => a.status === 'CONFIRMED').length
    const pendingToday     = todayAppts.filter(a => a.status === 'PENDING').length
    const completedToday   = todayAppts.filter(a => a.status === 'COMPLETED').length

    roleContext = `
## Today's Appointments (${fmtDate(todayStart)})
Total: ${todayAppts.length} | Confirmed: ${confirmedToday} | Pending: ${pendingToday} | Completed: ${completedToday}
${todayAppts.length === 0 ? 'No appointments today.' : todayAppts.map(fmtAppt).join('\n')}

## Pending Booking Requests (clinic-wide)
Total pending: ${pendingAppts.length}
${pendingAppts.length === 0 ? 'No pending requests.' : pendingAppts.map(fmtAppt).join('\n')}

## This Week
Total appointments this week: ${weekCount}

## Dentists at this Clinic
${allDentists.map(d => `- Dr. ${d.user.firstName} ${d.user.lastName}${d.specialty ? ` (${d.specialty})` : ''}`).join('\n') || 'None listed.'}`
  }

  return `You are IntelliDent AI, a helpful assistant for ${clinic?.name ?? 'this dental clinic'}.
You are assisting a user with the role: ${roleName}.

## Clinic Information
- Name: ${clinic?.name ?? 'N/A'}
- Phone: ${clinic?.phone ?? 'N/A'}
- Email: ${clinic?.email ?? 'N/A'}
- Working Days: ${daysStr}
- Operating Hours: ${hoursStr}

## Available Services
- ${servicesStr || 'No services listed'}
${roleContext}

## Guidelines
- Be professional, friendly, and concise
- Use the live data above to answer questions accurately (appointment counts, schedules, patient names, etc.)
- Answer questions about dental procedures, services, clinic policies, and appointments
- For booking, guide patients to use the "Book Appointment" button in My Schedules
- Never disclose or speculate about patient data to users who are not authorized to see it
- AI suggestions are recommendations only — staff must confirm any changes
- If asked something not covered by the data above, say so honestly
${role === 4 ? '- You are speaking with a PATIENT. Only discuss their own appointments and general clinic information. Never mention other patients.' : ''}
${role === 2 ? '- You are speaking with a DENTIST. Answer questions about their own schedule, their patients, and clinical topics.' : ''}
${role === 3 ? '- You are speaking with a RECEPTIONIST. You can answer questions about today\'s schedule, pending bookings, patient appointments, and operational tasks.' : ''}
${role === 1 || role === 0 ? '- You are speaking with an ADMIN. You have full visibility of clinic operations, appointments, and staff schedules.' : ''}`
}

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
      data: {
        userId: session.userId,
        clinicId: session.clinicId,
        title: message.slice(0, 80),
      },
      include: { messages: true },
    })
  }

  const systemPrompt = await buildSystemPrompt(session)

  let aiText
  try {
    aiText = await chatWithHistory(systemPrompt, chatSession.messages, message.trim())
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'AI service unavailable. Please try again.', detail }, { status: 503 })
  }

  // Save both messages and update session timestamp
  await prisma.chatMessage.createMany({
    data: [
      { sessionId: chatSession.id, role: 'USER', content: message.trim() },
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
      metadata: { messageLength: message.trim().length },
    },
  })

  return NextResponse.json({
    sessionId: chatSession.id,
    message: { role: 'ASSISTANT', content: aiText },
  })
}
