import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Session-based schedule read for any authenticated role
export async function GET() {
  const caller = await getAuthContext()
  const clinicId = caller?.clinicId
  if (!clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schedule = await prisma.clinicSchedule.findUnique({
    where: { clinicId },
  })

  return NextResponse.json(schedule ?? { workingDays: [], openTime: '08:00', closeTime: '17:00' })
}
