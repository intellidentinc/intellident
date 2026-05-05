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

  if (role === 4) {
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

      if (upcoming.length > 0) {
        roleContext =
          `\nThe patient's upcoming appointments:\n` +
          upcoming
            .map(
              (a) =>
                `- ${a.appointmentCode ?? a.id}: ${a.service.name} on ${new Date(a.scheduledAt).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} at ${new Date(a.scheduledAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })} — Status: ${a.status}${a.dentist ? ` with Dr. ${a.dentist.user.firstName} ${a.dentist.user.lastName}` : ''}`
            )
            .join('\n')
      } else {
        roleContext = `\nThe patient has no upcoming appointments.`
      }
    }
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
- Answer questions about dental procedures, services, clinic policies, and appointments
- For booking, guide patients to use the "Book Appointment" button in My Schedules
- Never disclose or speculate about other patients' personal information or records
- AI suggestions are recommendations only — staff must confirm any changes
- If asked something outside your knowledge, say so honestly
${role === 4 ? '- You are speaking with a PATIENT. Only discuss their own appointments and general clinic information.' : ''}
${role >= 1 && role <= 3 ? '- You are speaking with CLINIC STAFF. You can discuss scheduling, appointments, and operational questions.' : ''}`
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
