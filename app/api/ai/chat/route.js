import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatWithTools } from '@/lib/gemini'
import { buildSystemPrompt } from '@/lib/ai-prompt'
import { getToolsForRole, buildExecutor } from '@/lib/ai-tools'

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
