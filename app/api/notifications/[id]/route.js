import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/notifications/[id] — mark single notification as read
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Only the owner can mark it read
  const notif = await prisma.inAppNotification.findFirst({
    where: { id, userId: session.userId },
  })
  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.inAppNotification.update({
    where: { id },
    data: { isRead: true },
  })

  return NextResponse.json({ ok: true })
}
