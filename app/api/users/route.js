import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })

  if (!caller || caller.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '0', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '10', 10)
  const search = searchParams.get('search') ?? ''
  const sortField = searchParams.get('sortField') ?? 'firstName'
  const sortOrder = searchParams.get('sortOrder') ?? 'asc'

  const dbSortField = sortField === 'name' ? 'firstName' : sortField
  const validSortFields = ['firstName', 'lastName', 'email', 'role', 'createdAt']
  const safeSortField = validSortFields.includes(dbSortField) ? dbSortField : 'firstName'
  const safeSortOrder = sortOrder === 'desc' ? 'desc' : 'asc'

  const where = {
    clinicId: caller.clinicId,
    isDeleted: false,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {})
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
      orderBy: { [safeSortField]: safeSortOrder },
      skip: page * pageSize,
      take: pageSize
    }),
    prisma.user.count({ where })
  ])

  return NextResponse.json({ users, total })
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })

  if (!caller || caller.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { firstName, lastName, email, phone, role, wrappedKey, keySalt } = await request.json()

  if (!firstName || !lastName || !email || !role || !wrappedKey || !keySalt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (![ROLES.DENTIST, ROLES.RECEPTIONIST].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 })
  }

  const DEFAULT_PASSWORD = 'Intellident2026#'
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        password: hashedPassword,
        passwordHistory: [hashedPassword],
        role,
        wrappedKey,
        keySalt,
        clinicId: caller.clinicId,
      }
    })

    if (role === ROLES.DENTIST) {
      await tx.dentist.create({ data: { userId: user.id, clinicId: caller.clinicId } })
    } else {
      await tx.receptionist.create({ data: { userId: user.id, clinicId: caller.clinicId } })
    }

    return user
  })

  return NextResponse.json({ id: newUser.id }, { status: 201 })
}
