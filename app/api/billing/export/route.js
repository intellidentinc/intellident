import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { searchTerm, safeDate } from '@/lib/validate'

const VALID_STATUS = ['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']
const MAX_EXPORT_ROWS = 5000

async function getCaller() {
  const session = await getSession()
  if (!session) return null
  const caller = await getAuthContext()
  if (!caller || ![ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.SUPERADMIN].includes(caller.role)) return null
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  return { ...caller, clinicId }
}

export async function GET(request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status   = searchParams.get('status') ?? ''
  const dateFrom = safeDate(searchParams.get('dateFrom'))
  const dateTo   = safeDate(searchParams.get('dateTo'))
  const search   = searchTerm(searchParams.get('search'))

  const where = {
    clinicId: caller.clinicId,
    isDeleted: false,
    ...(status && VALID_STATUS.includes(status) ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo   ? { lte: new Date(dateTo.setHours(23, 59, 59, 999)) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { patient: { firstName: { contains: search, mode: 'insensitive' } } },
            { patient: { lastName:  { contains: search, mode: 'insensitive' } } },
            { appointment: { appointmentCode: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const billings = await prisma.billing.findMany({
    where,
    select: {
      createdAt:     true,
      receiptNumber: true,
      amount:        true,
      amountPaid:    true,
      balance:       true,
      status:        true,
      patient: { select: { firstName: true, lastName: true, patientCode: true } },
      appointment: {
        select: {
          appointmentCode: true,
          scheduledAt: true,
          service: { select: { name: true } },
          dentist: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_EXPORT_ROWS,
  })

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({
    userId: caller.id,
    clinicId: caller.clinicId,
    action: 'EXPORT',
    entity: 'Billing',
    entityId: caller.clinicId,
    ipAddress: ip,
    userAgent,
    metadata: { filters: { status, search, dateFrom, dateTo }, rowCount: billings.length },
  })

  return NextResponse.json({ billings })
}
