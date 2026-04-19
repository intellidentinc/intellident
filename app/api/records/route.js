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
  if (!caller || caller.role !== ROLES.DENTIST) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dentist = await prisma.dentist.findUnique({
    where: { userId: session.userId },
    select: { id: true, clinicId: true },
  })
  if (!dentist || dentist.clinicId !== caller.clinicId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page') ?? '0', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '10', 10)
  const search   = searchParams.get('search')?.trim()

  const where = {
    clinicId: caller.clinicId,
    appointments: {
      some: {
        dentistId: dentist.id,
        isDeleted: false,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
    },
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName:  { contains: search, mode: 'insensitive' } },
            { patientCode: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: {
        appointments: {
          where: {
            dentistId: dentist.id,
            isDeleted: false,
            status: { in: ['CONFIRMED', 'COMPLETED'] },
          },
          orderBy: { scheduledAt: 'desc' },
          take: 1,
          select: { scheduledAt: true, status: true, service: { select: { name: true } } },
        },
        _count: {
          select: {
            appointments: {
              where: {
                dentistId: dentist.id,
                isDeleted: false,
                status: { in: ['CONFIRMED', 'COMPLETED'] },
              },
            },
          },
        },
      },
      orderBy: { lastName: 'asc' },
      skip: page * pageSize,
      take: pageSize,
    }),
    prisma.patient.count({ where }),
  ])

  return NextResponse.json({ patients, total })
}
