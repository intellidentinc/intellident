import { NextResponse, after } from 'next/server'
import bcrypt from 'bcrypt'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str, sanitizeEmail, secret, pageParams } from '@/lib/validate'
import { sendPatientClaimEmail } from '@/lib/email'
import { generatePatientCode } from '@/lib/patients'

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()

  if (!caller || !(caller.role === ROLES.RECEPTIONIST || isAdmin(caller.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { searchParams } = new URL(request.url)
  const { page, pageSize } = pageParams(searchParams, { defaultSize: 10, maxSize: 100 })
  const sortField = searchParams.get('sortField') ?? 'firstName'
  const sortOrder = searchParams.get('sortOrder') ?? 'asc'

  const validSortFields = ['firstName', 'lastName', 'createdAt']
  const safeSortField = validSortFields.includes(sortField) ? sortField : 'firstName'
  const safeSortOrder = sortOrder === 'desc' ? 'desc' : 'asc'

  const where = { isDeleted: false, role: ROLES.PATIENT, patients: { some: { clinicId, isDeleted: false } } }

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
        patients: { where: { clinicId, isDeleted: false }, select: { patientCode: true } },
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
    patientCode: u.patients[0]?.patientCode ?? null,
  }))

  return NextResponse.json({ patients: result, total })
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()

  if (!caller || !(caller.role === ROLES.RECEPTIONIST || isAdmin(caller.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { ip, userAgent } = getRequestMeta(request)
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const firstName = str(parsed.body.firstName, 100)
  const lastName  = str(parsed.body.lastName, 100)
  const email     = sanitizeEmail(parsed.body.email)
  const phone     = str(parsed.body.phone, 20)
  const tempPassword = secret(parsed.body.tempPassword, 128)
  const wrappedKey = secret(parsed.body.wrappedKey, 1024)
  const keySalt    = secret(parsed.body.keySalt, 256)

  if (!firstName || !lastName || !email || !phone || !tempPassword || !wrappedKey || !keySalt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // The temp password doubles as the KEK password used to wrap the master key
  // client-side, so it must satisfy the password policy.
  if (!PASSWORD_REGEX.test(tempPassword)) {
    return NextResponse.json({ error: 'Temporary password does not meet the password policy' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 })
  }

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
        clinicId,
        mustChangePassword: true,
      },
    })

    // Generate patientCode: PAT-{CLINICCODE}-{YYYY}-{#####}
    const patientCode = await generatePatientCode(clinicId, tx)

    const patient = await tx.patient.create({
      data: {
        userId: user.id,
        clinicId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        patientCode,
      },
    })

    return patient
  })

  logAudit({ userId: session.userId, clinicId, action: 'CREATE', entity: 'Patient', entityId: newPatient.id, ipAddress: ip, userAgent, metadata: { patientCode: newPatient.patientCode } })

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } })
  after(
    sendPatientClaimEmail({
      to: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      patientCode: newPatient.patientCode,
      tempPassword,
      clinicName: clinic?.name ?? 'your clinic',
      signInUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/sign-in`,
    }).catch((err) => console.error('sendPatientClaimEmail failed:', err))
  )

  return NextResponse.json({ id: newPatient.id }, { status: 201 })
}
