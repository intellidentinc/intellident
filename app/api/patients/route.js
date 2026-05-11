import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str, sanitizeEmail, secret } from '@/lib/validate'

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })

  if (!caller || caller.role !== ROLES.RECEPTIONIST) {
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

  const where = { clinicId: caller.clinicId, isDeleted: false, role: ROLES.PATIENT }

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
        patient: { select: { patientCode: true } },
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
    patientCode: u.patient?.patientCode ?? null,
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

  if (!caller || caller.role !== ROLES.RECEPTIONIST) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ip, userAgent } = getRequestMeta(request)
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const firstName = str(parsed.body.firstName, 100)
  const lastName  = str(parsed.body.lastName, 100)
  const email     = sanitizeEmail(parsed.body.email)
  const phone     = str(parsed.body.phone, 20)
  const wrappedKey = secret(parsed.body.wrappedKey, 1024)
  const keySalt    = secret(parsed.body.keySalt, 256)

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
        role: ROLES.PATIENT,
        wrappedKey,
        keySalt,
        clinicId: caller.clinicId,
      },
    })

    // Generate patientCode: PAT-{CLINICCODE}-{YYYY}-{#####}
    const clinic = await tx.clinic.findUnique({ where: { id: caller.clinicId }, select: { code: true } })
    const year = new Date().getFullYear()
    const existingCount = await tx.patient.count({
      where: { clinicId: caller.clinicId },
    })
    const patientCode = `PAT-${clinic?.code ?? 'CLN'}-${year}-${String(existingCount + 1).padStart(5, '0')}`

    const patient = await tx.patient.create({
      data: {
        userId: user.id,
        clinicId: caller.clinicId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        patientCode,
      },
    })

    return patient
  })

  logAudit({ userId: session.userId, clinicId: caller.clinicId, action: 'CREATE', entity: 'Patient', entityId: newPatient.id, ipAddress: ip, userAgent, metadata: { patientCode: newPatient.patientCode } })

  return NextResponse.json({ id: newPatient.id }, { status: 201 })
}
