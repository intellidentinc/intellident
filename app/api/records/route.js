import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()
  if (!caller || caller.role !== ROLES.DENTIST) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dentist = await prisma.dentist.findUnique({
    where: { userId: session.userId },
    select: { id: true, clinicId: true },
  })
  if (!dentist) return NextResponse.json({ error: 'Dentist profile not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const page     = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10)))
  const search   = searchParams.get('search') ?? ''

  const apptFilter = {
    dentistId: dentist.id,
    isDeleted: false,
    status: { in: ['CONFIRMED', 'COMPLETED'] },
  }

  const where = {
    clinicId: dentist.clinicId,
    isDeleted: false,
    appointments: { some: apptFilter },
    ...(search
      ? {
          OR: [
            { firstName:   { contains: search, mode: 'insensitive' } },
            { lastName:    { contains: search, mode: 'insensitive' } },
            { patientCode: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [total, patients] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        patientCode: true,
        appointments: {
          where: apptFilter,
          orderBy: { scheduledAt: 'desc' },
          take: 1,
          select: {
            status: true,
            scheduledAt: true,
            service: { select: { name: true } },
          },
        },
        _count: {
          select: { appointments: { where: apptFilter } },
        },
      },
      orderBy: { lastName: 'asc' },
      skip: page * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({ patients, total })
}
