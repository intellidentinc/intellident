import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'

const VALID_SORT_FIELDS = ['createdAt', 'action', 'entity']
const VALID_ACTIONS = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'VERIFY', 'AI_INTERACTION', 'LOCKOUT', 'BREACH_ALERT']

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })

  if (!caller || !isAdmin(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { searchParams } = new URL(request.url)
  const page     = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)))
  const rawSort  = searchParams.get('sortField') ?? 'createdAt'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
  const action   = searchParams.get('action') ?? ''
  const entity   = searchParams.get('entity') ?? ''
  const search   = searchParams.get('search') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo') ?? ''

  const sortField = VALID_SORT_FIELDS.includes(rawSort) ? rawSort : 'createdAt'

  const where = {
    clinicId,
    ...(action && VALID_ACTIONS.includes(action) ? { action } : {}),
    ...(entity ? { entity: { contains: entity, mode: 'insensitive' } } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { user: { firstName: { contains: search, mode: 'insensitive' } } },
            { user: { lastName:  { contains: search, mode: 'insensitive' } } },
            { user: { email:     { contains: search, mode: 'insensitive' } } },
            { entityId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id:        true,
        action:    true,
        entity:    true,
        entityId:  true,
        ipAddress: true,
        userAgent: true,
        metadata:  true,
        createdAt: true,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
      },
      orderBy: { [sortField]: sortOrder },
      skip: page * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total })
}
