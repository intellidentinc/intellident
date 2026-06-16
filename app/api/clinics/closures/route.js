import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Session-based closures read for any authenticated role
export async function GET() {
  const caller = await getAuthContext()
  const clinicId = caller?.clinicId
  if (!clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const closures = await prisma.clinicClosure.findMany({
    where: { clinicId },
    select: { id: true, date: true, reason: true },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ closures })
}
