import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await params

  const chatSession = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: session.userId, clinicId: session.clinicId, isDeleted: false },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  if (!chatSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  return NextResponse.json({ session: chatSession, messages: chatSession.messages })
}

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await params

  const chatSession = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: session.userId, clinicId: session.clinicId, isDeleted: false },
  })

  if (!chatSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
