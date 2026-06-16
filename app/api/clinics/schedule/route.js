import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

// Session-based schedule read for any authenticated role
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  const clinicId = caller?.role === ROLES.SUPERADMIN ? session.clinicId : caller?.clinicId
  if (!clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schedule = await prisma.clinicSchedule.findUnique({
    where: { clinicId },
  })

  return NextResponse.json(schedule ?? { workingDays: [], openTime: '08:00', closeTime: '17:00' })
}
