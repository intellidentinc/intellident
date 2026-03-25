import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Session-based closures read for any authenticated role
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { clinicId: true },
  })
  if (!caller?.clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const closures = await prisma.clinicClosure.findMany({
    where: { clinicId: caller.clinicId },
    select: { id: true, date: true, reason: true },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ closures })
}
