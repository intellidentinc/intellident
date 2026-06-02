import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str, sanitizeEmail, secret } from '@/lib/validate'
import { sendPatientClaimEmail } from '@/lib/email'

function generatePatientPassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digit = '0123456789'
  const special = '!@#$%^&*'
  const all = upper + lower + digit + special
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digit[Math.floor(Math.random() * digit.length)],
    special[Math.floor(Math.random() * special.length)],
  ]
  const length = 8 + Math.floor(Math.random() * 5)
  for (let i = required.length; i < length; i++) {
    required.push(all[Math.floor(Math.random() * all.length)])
  }
  return required.sort(() => Math.random() - 0.5).join('')
}

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

  const tempPassword = generatePatientPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

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
        mustChangePassword: true,
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

  const clinic = await prisma.clinic.findUnique({ where: { id: caller.clinicId }, select: { name: true } })
  sendPatientClaimEmail({
    to: email.trim().toLowerCase(),
    firstName: firstName.trim(),
    patientCode: newPatient.patientCode,
    tempPassword,
    clinicName: clinic?.name ?? 'your clinic',
    signInUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/sign-in`,
  }).catch(() => {})

  return NextResponse.json({ id: newPatient.id }, { status: 201 })
}
