import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

// Session-based closures read for any authenticated role
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  const clinicId = caller?.role === ROLES.SUPERADMIN ? session.clinicId : caller?.clinicId
  if (!clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const closures = await prisma.clinicClosure.findMany({
    where: { clinicId },
    select: { id: true, date: true, reason: true },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ closures })
}
