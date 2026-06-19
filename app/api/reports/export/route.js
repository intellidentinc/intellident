import { NextResponse } from 'next/server'
import { getSession, isStepUpValid, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { logAudit, getRequestMeta } from '@/lib/audit'
import { safeDate, str } from '@/lib/validate'

const MAX_ROWS = 5000

function dateRange(field, dateFrom, dateTo) {
  const from = safeDate(dateFrom)
  const to   = safeDate(dateTo)
  if (!from && !to) return {}
  return {
    [field]: {
      ...(from ? { gte: from } : {}),
      ...(to   ? { lte: new Date(to.setHours(23, 59, 59, 999)) } : {}),
    },
  }
}

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()
  if (!caller || !isAdmin(caller.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!isStepUpValid(session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { ip, userAgent } = getRequestMeta(request)
  const { searchParams } = new URL(request.url)
  const type      = searchParams.get('type')      ?? 'appointments'
  const dateFrom  = searchParams.get('dateFrom')  ?? ''
  const dateTo    = searchParams.get('dateTo')    ?? ''
  const serviceId = str(searchParams.get('serviceId'), 50)
  const dentistId = str(searchParams.get('dentistId'), 50)

  if (type === 'appointments') {
    const rows = await prisma.appointment.findMany({
      where:   { clinicId, isDeleted: false, ...dateRange('scheduledAt', dateFrom, dateTo) },
      select: {
        scheduledAt:     true,
        appointmentCode: true,
        status:          true,
        patient: { select: { firstName: true, lastName: true } },
        dentist: { select: { user: { select: { firstName: true, lastName: true } } } },
        service: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take:    MAX_ROWS,
    })
    logAudit({ userId: session.userId, clinicId, action: 'EXPORT', entity: 'Report', entityId: type, ipAddress: ip, userAgent, metadata: { type, filters: { dateFrom, dateTo }, rowCount: rows.length } })
    return NextResponse.json({ rows, type })
  }

  if (type === 'revenue') {
    const rows = await prisma.billing.findMany({
      where: {
        clinicId, isDeleted: false,
        ...dateRange('createdAt', dateFrom, dateTo),
        ...(serviceId || dentistId ? {
          appointment: {
            ...(serviceId ? { serviceId } : {}),
            ...(dentistId ? { dentistId } : {}),
          },
        } : {}),
      },
      select: {
        createdAt:     true,
        receiptNumber: true,
        amount:        true,
        amountPaid:    true,
        balance:       true,
        status:        true,
        patient:     { select: { firstName: true, lastName: true } },
        appointment: { select: { service: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take:    MAX_ROWS,
    })
    logAudit({ userId: session.userId, clinicId, action: 'EXPORT', entity: 'Report', entityId: type, ipAddress: ip, userAgent, metadata: { type, filters: { dateFrom, dateTo }, rowCount: rows.length } })
    return NextResponse.json({ rows, type })
  }

  if (type === 'patients') {
    const rows = await prisma.patient.findMany({
      where:   { clinicId, isDeleted: false, ...dateRange('createdAt', dateFrom, dateTo) },
      select: {
        patientCode: true,
        firstName:   true,
        lastName:    true,
        gender:      true,
        dateOfBirth: true,
        createdAt:   true,
      },
      orderBy: { createdAt: 'desc' },
      take:    MAX_ROWS,
    })
    logAudit({ userId: session.userId, clinicId, action: 'EXPORT', entity: 'Report', entityId: type, ipAddress: ip, userAgent, metadata: { type, filters: { dateFrom, dateTo }, rowCount: rows.length } })
    return NextResponse.json({ rows, type })
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
}
