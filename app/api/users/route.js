import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str, sanitizeEmail, secret } from '@/lib/validate'
import { sendStaffWelcomeEmail } from '@/lib/email'

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

async function generateUsername(lastName, clinicCode, tx) {
  const base = lastName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 20)
  const prefix = `${clinicCode}-${base}-`
  const existing = await tx.user.findMany({
    where: { username: { startsWith: prefix } },
    select: { username: true },
  })
  const nums = existing.map(u => parseInt(u.username.split('-').pop())).filter(n => !isNaN(n))
  const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()

  if (!caller || !isAdmin(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

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
    clinicId,
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
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, username: true, createdAt: true },
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

  const caller = await getAuthContext()

  if (!caller || !isAdmin(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { ip, userAgent } = getRequestMeta(request)
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const firstName     = str(parsed.body.firstName, 100)
  const middleInitial = str(parsed.body.middleInitial, 100)
  const lastName      = str(parsed.body.lastName, 100)
  const email         = sanitizeEmail(parsed.body.email)
  const phone         = str(parsed.body.phone, 20)
  const { role }      = parsed.body
  const tempPassword  = secret(parsed.body.tempPassword, 128)
  const wrappedKey    = secret(parsed.body.wrappedKey, 1024)
  const keySalt       = secret(parsed.body.keySalt, 256)

  if (!firstName || !lastName || !email || !role || !tempPassword || !wrappedKey || !keySalt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Clinic admins may create staff (dentist/receptionist). Only super admins may
  // create a clinic ADMIN — this is how a brand-new clinic gets its first admin.
  const allowedRoles = caller.role === ROLES.SUPERADMIN
    ? [ROLES.ADMIN, ROLES.DENTIST, ROLES.RECEPTIONIST]
    : [ROLES.DENTIST, ROLES.RECEPTIONIST]
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
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

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { code: true } })
  if (!clinic?.code) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  const newUser = await prisma.$transaction(async (tx) => {
    const username = await generateUsername(lastName, clinic.code, tx)
    const user = await tx.user.create({
      data: {
        email,
        firstName,
        middleInitial: middleInitial || null,
        lastName,
        phone: phone || null,
        password: hashedPassword,
        passwordHistory: [hashedPassword],
        role,
        wrappedKey,
        keySalt,
        clinicId,
        username,
        mustChangePassword: true,
      }
    })

    // ADMIN has no separate profile record; only dentist/receptionist do.
    if (role === ROLES.DENTIST) {
      await tx.dentist.create({ data: { userId: user.id, clinicId: clinicId } })
    } else if (role === ROLES.RECEPTIONIST) {
      await tx.receptionist.create({ data: { userId: user.id, clinicId: clinicId } })
    }

    return user
  })

  sendStaffWelcomeEmail({
    to: newUser.email,
    firstName: newUser.firstName,
    role: role === ROLES.ADMIN ? 'Administrator' : role === ROLES.DENTIST ? 'Dentist' : 'Receptionist',
    tempPassword,
    username: newUser.username,
  }).catch(() => {})

  logAudit({ userId: session.userId, clinicId: clinicId, action: 'CREATE', entity: 'User', entityId: newUser.id, ipAddress: ip, userAgent, metadata: { role, email: newUser.email } })

  return NextResponse.json({ id: newUser.id }, { status: 201 })
}
