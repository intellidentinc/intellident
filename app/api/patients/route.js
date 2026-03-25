import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })

  if (!caller || caller.role !== 'RECEPTIONIST') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '0', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '10', 10)
  const sortField = searchParams.get('sortField') ?? 'firstName'
  const sortOrder = searchParams.get('sortOrder') ?? 'asc'

  const validSortFields = ['firstName', 'lastName', 'createdAt']
  const safeSortField = validSortFields.includes(sortField) ? sortField : 'firstName'
  const safeSortOrder = sortOrder === 'desc' ? 'desc' : 'asc'

  const where = { clinicId: caller.clinicId, isDeleted: false, role: 'PATIENT' }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        createdAt: true,
      },
      orderBy: { [safeSortField]: safeSortOrder },
      skip: page * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  const result = users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    email: u.email,
    createdAt: u.createdAt,
  }))

  return NextResponse.json({ patients: result, total })
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })

  if (!caller || caller.role !== 'RECEPTIONIST') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { firstName, lastName, email, phone, wrappedKey, keySalt } = await request.json()

  if (!firstName || !lastName || !email || !phone || !wrappedKey || !keySalt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 })
  }

  const DEFAULT_PASSWORD = 'Intellident2026#'
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  const newPatient = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        password: hashedPassword,
        passwordHistory: [hashedPassword],
        role: 'PATIENT',
        wrappedKey,
        keySalt,
        clinicId: caller.clinicId,
      },
    })

    const patient = await tx.patient.create({
      data: {
        userId: user.id,
        clinicId: caller.clinicId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      },
    })

    return patient
  })

  return NextResponse.json({ id: newPatient.id }, { status: 201 })
}
