import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!caller || ![ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.PATIENT, ROLES.SUPERADMIN].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { searchParams } = new URL(request.url)
  const serviceId = searchParams.get('serviceId')

  if (!serviceId) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 })
  }

  const dentists = await prisma.dentist.findMany({
    where: {
      clinicId,
      isDeleted: false,
      services: { some: { id: serviceId, isDeleted: false } },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  })

  return NextResponse.json({ dentists })
}
