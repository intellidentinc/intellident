import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getUser() {
  const session = await getSession()
  if (!session) return null
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, clinicId: true, role: true },
  })
}

// GET /api/notifications — fetch current user's notifications + unread count
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [notifications, unreadCount] = await Promise.all([
    prisma.inAppNotification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.inAppNotification.count({
      where: { userId: user.id, isRead: false },
    }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

// PATCH /api/notifications — mark all as read
export async function PATCH() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.inAppNotification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({ ok: true })
}
