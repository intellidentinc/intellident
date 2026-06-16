import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET() {
  const caller = await getAuthContext()
  if (!caller || ![ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.PATIENT, ROLES.SUPERADMIN].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.clinicId

  const services = await prisma.service.findMany({
    where: { clinicId, isDeleted: false },
    select: { id: true, name: true, duration: true, bufferTime: true, price: true },
    orderBy: { name: 'asc' },
  })

  const res = NextResponse.json({ services })
  res.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=3600')
  return res
}
