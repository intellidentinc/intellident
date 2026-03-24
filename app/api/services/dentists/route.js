import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })
  if (!caller || caller.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dentists = await prisma.dentist.findMany({
    where: { clinicId: caller.clinicId, isDeleted: false },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { user: { firstName: 'asc' } }
  })

  return NextResponse.json({ dentists })
}
