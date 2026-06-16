import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET(request) {
  const caller = await getAuthContext()
  if (!caller || ![ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.PATIENT, ROLES.SUPERADMIN].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.clinicId

  const { searchParams } = new URL(request.url)
  const serviceIdsParam = searchParams.get('serviceIds') ?? searchParams.get('serviceId')

  if (!serviceIdsParam) {
    return NextResponse.json({ error: 'serviceIds is required' }, { status: 400 })
  }

  const serviceIds = serviceIdsParam.split(',').filter(Boolean)

  // Intersection: only dentists assigned to ALL selected services
  const dentists = await prisma.dentist.findMany({
    where: {
      clinicId,
      isDeleted: false,
      AND: serviceIds.map(id => ({
        services: { some: { id, isDeleted: false } },
      })),
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  })

  return NextResponse.json({ dentists })
}
