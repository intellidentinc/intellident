import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!caller || ![ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.PATIENT].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const services = await prisma.service.findMany({
    where: { clinicId: caller.clinicId, isDeleted: false },
    select: { id: true, name: true, duration: true, bufferTime: true, price: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ services })
}
