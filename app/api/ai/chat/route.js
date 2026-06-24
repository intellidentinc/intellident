import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatWithTools } from '@/lib/ai'
import { buildSystemPrompt } from '@/lib/ai-prompt'
import { getToolsForRole, buildExecutor } from '@/lib/ai-tools'
import { parseJsonBody } from '@/lib/validate'
import { checkRateLimit } from '@/lib/rateLimit'

async function getCaller(session) {
  const user = await getAuthContext()
  if (!user) return null
  const clinicId = user.clinicId ?? session.clinicId
  return { ...user, clinicId }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getCaller(session)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sessions = await prisma.chatSession.findMany({
    where: { userId: session.userId, clinicId: caller.clinicId, isDeleted: false },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json({ sessions })
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getCaller(session)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Per-user rate limit to bound OpenAI spend / DoS from a single authenticated account.
  const { allowed } = await checkRateLimit(`ai-chat:${session.userId}`, 30, 5 * 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many messages. Please wait a moment and try again.' }, { status: 429 })
  }

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { message, sessionId } = parsed.body
  if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  if (message.trim().length > 2000) return NextResponse.json({ error: 'Message too long (max 2000 characters)' }, { status: 400 })

  // Get or create chat session
  let chatSession, systemPrompt, tools
  try {
    if (sessionId) {
      chatSession = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: session.userId, clinicId: caller.clinicId, isDeleted: false },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
      if (!chatSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    } else {
      chatSession = await prisma.chatSession.create({
        data: { userId: session.userId, clinicId: caller.clinicId, title: message.slice(0, 80) },
        include: { messages: true },
      })
    }

    const callerForPrompt = { ...session, role: caller.role, clinicId: caller.clinicId }
    ;[systemPrompt, tools] = await Promise.all([
      buildSystemPrompt(callerForPrompt),
      Promise.resolve(getToolsForRole(caller.role)),
    ])
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to initialize chat session.', detail }, { status: 503 })
  }

  const MAX_HISTORY = 5

  let aiText
  try {
    aiText = (await chatWithTools(
      systemPrompt,
      chatSession.messages.slice(-MAX_HISTORY),
      message.trim(),
      tools,
      buildExecutor({ ...session, role: caller.role, clinicId: caller.clinicId }),
    )).trim()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'AI service unavailable. Please try again.', detail }, { status: 503 })
  }

  try {
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
        clinicId: caller.clinicId,
        action: 'AI_INTERACTION',
        entity: 'ChatSession',
        entityId: chatSession.id,
        metadata: { messageLength: message.trim().length, toolsAvailable: tools.map((t) => t.function.name) },
      },
    })
  } catch {
    // Save failure does not prevent returning the AI response
  }

  return NextResponse.json({ sessionId: chatSession.id, message: { role: 'ASSISTANT', content: aiText } })
}
