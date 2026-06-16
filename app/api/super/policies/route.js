import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, sanitizeExpiryRoles } from '@/lib/roles'
import { parseJsonBody } from '@/lib/validate'

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  if (!user || user.role !== ROLES.SUPERADMIN) return null
  return session
}

export async function GET() {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clinics = await prisma.clinic.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      passwordExpiryEnabled: true,
      passwordExpiryDays: true,
      passwordExpiryRoles: true,
      singleSessionEnabled: true,
      reminder1Hours: true,
      reminder2Hours: true,
      auditLogRetentionDays: true,
      patientRecordRetentionDays: true,
      billingRetentionDays: true,
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(clinics)
}

const ALLOWED_FIELDS = {
  passwordExpiryEnabled: 'boolean',
  passwordExpiryDays: 'expiryDays',
  passwordExpiryRoles: 'roles',
  singleSessionEnabled: 'boolean',
  reminder1Hours: 'hours',
  reminder2Hours: 'hours',
  auditLogRetentionDays: 'retention',
  patientRecordRetentionDays: 'retention',
  billingRetentionDays: 'retention',
}

export async function POST(request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { clinicIds, patch } = parsed.body

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return NextResponse.json({ error: 'patch is required' }, { status: 400 })
  }

  const sanitized = {}
  for (const [key, val] of Object.entries(patch)) {
    const type = ALLOWED_FIELDS[key]
    if (!type) continue

    if (type === 'boolean') {
      if (typeof val !== 'boolean') return NextResponse.json({ error: `${key} must be boolean` }, { status: 400 })
      sanitized[key] = val
    } else if (type === 'hours') {
      const n = parseInt(val, 10)
      if (isNaN(n) || n < 1 || n > 72) return NextResponse.json({ error: `${key} must be between 1 and 72` }, { status: 400 })
      sanitized[key] = n
    } else if (type === 'expiryDays') {
      const n = parseInt(val, 10)
      if (isNaN(n) || n < 30 || n > 365) return NextResponse.json({ error: `${key} must be between 30 and 365` }, { status: 400 })
      sanitized[key] = n
    } else if (type === 'roles') {
      const rolesResult = sanitizeExpiryRoles(val)
      if (rolesResult.error) return NextResponse.json({ error: rolesResult.error }, { status: 400 })
      sanitized[key] = rolesResult.roles
    } else if (type === 'retention') {
      if (val === null) {
        sanitized[key] = null
      } else {
        const n = parseInt(val, 10)
        if (isNaN(n) || n < 1) return NextResponse.json({ error: `${key} must be ≥ 1 or null` }, { status: 400 })
        sanitized[key] = n
      }
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const applyToAll = !clinicIds || clinicIds[0] === 'all'
  const where = applyToAll
    ? { isDeleted: false }
    : { id: { in: clinicIds }, isDeleted: false }

  const result = await prisma.clinic.updateMany({ where, data: sanitized })

  return NextResponse.json({ updated: result.count })
}
