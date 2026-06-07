import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'

function dateRange(field, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {}
  return {
    [field]: {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
    },
  }
}

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!caller || !isAdmin(caller.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const { searchParams } = new URL(request.url)
  const type     = searchParams.get('type')     ?? 'appointments'
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''

  // ─── Appointments ─────────────────────────────────────────────────────────
  if (type === 'appointments') {
    const baseWhere = { clinicId, isDeleted: false, ...dateRange('scheduledAt', dateFrom, dateTo) }

    const [total, byStatusRaw, byServiceRaw, byDentistRaw, allAppts] = await Promise.all([
      prisma.appointment.count({ where: baseWhere }),
      prisma.appointment.groupBy({ by: ['status'],    where: baseWhere, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['serviceId'], where: baseWhere, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['dentistId'], where: baseWhere, _count: { _all: true } }),
      prisma.appointment.findMany({ where: baseWhere, select: { scheduledAt: true } }),
    ])

    const statusCounts = Object.fromEntries(byStatusRaw.map(s => [s.status, s._count._all]))
    const summary = {
      total,
      completed:   statusCounts.COMPLETED    ?? 0,
      pending:     statusCounts.PENDING      ?? 0,
      confirmed:   statusCounts.CONFIRMED    ?? 0,
      cancelled:   statusCounts.CANCELLED    ?? 0,
      noShow:      statusCounts.NO_SHOW      ?? 0,
      rescheduled: statusCounts.RESCHEDULED  ?? 0,
    }

    const byStatus = byStatusRaw
      .map(s => ({ status: s.status, count: s._count._all }))
      .sort((a, b) => b.count - a.count)

    // Resolve service names
    const serviceIds = byServiceRaw.map(s => s.serviceId).filter(Boolean)
    const services = serviceIds.length
      ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } })
      : []
    const serviceMap = Object.fromEntries(services.map(s => [s.id, s.name]))
    const byService = byServiceRaw
      .map(s => ({ name: s.serviceId ? (serviceMap[s.serviceId] ?? 'Unknown') : 'No service', count: s._count._all }))
      .sort((a, b) => b.count - a.count)

    // Resolve dentist names + completed count per dentist
    const dentistIds = byDentistRaw.map(d => d.dentistId).filter(Boolean)
    const [dentists, byDentistCompleted] = await Promise.all([
      dentistIds.length
        ? prisma.dentist.findMany({ where: { id: { in: dentistIds } }, select: { id: true, user: { select: { firstName: true, lastName: true } } } })
        : [],
      prisma.appointment.groupBy({ by: ['dentistId'], where: { ...baseWhere, status: 'COMPLETED' }, _count: { _all: true } }),
    ])
    const dentistMap   = Object.fromEntries(dentists.map(d => [d.id, `${d.user.firstName} ${d.user.lastName}`]))
    const completedMap = Object.fromEntries(byDentistCompleted.map(d => [d.dentistId, d._count._all]))
    const byDentist = byDentistRaw
      .map(d => ({
        name:      d.dentistId ? (dentistMap[d.dentistId] ?? 'Unknown') : 'Any Available',
        count:     d._count._all,
        completed: completedMap[d.dentistId] ?? 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Monthly trend
    const monthMap = {}
    for (const a of allAppts) {
      const month = a.scheduledAt.toISOString().slice(0, 7)
      monthMap[month] = (monthMap[month] ?? 0) + 1
    }
    const byMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))

    return NextResponse.json({ summary, byStatus, byService, byDentist, byMonth })
  }

  // ─── Revenue ──────────────────────────────────────────────────────────────
  if (type === 'revenue') {
    const serviceId = searchParams.get('serviceId') ?? ''
    const dentistId = searchParams.get('dentistId') ?? ''

    const baseWhere = {
      clinicId, isDeleted: false,
      ...dateRange('createdAt', dateFrom, dateTo),
      ...(serviceId || dentistId ? {
        appointment: {
          ...(serviceId ? { serviceId } : {}),
          ...(dentistId ? { dentistId } : {}),
        },
      } : {}),
    }

    const [agg, byStatusRaw, billings] = await Promise.all([
      prisma.billing.aggregate({
        where: baseWhere,
        _sum:   { amount: true, amountPaid: true, balance: true },
        _count: { _all: true },
      }),
      prisma.billing.groupBy({
        by:    ['status'],
        where: baseWhere,
        _count: { _all: true },
        _sum:   { amount: true, amountPaid: true },
      }),
      prisma.billing.findMany({
        where: baseWhere,
        select: {
          amount: true, amountPaid: true, createdAt: true,
          appointment: { select: { service: { select: { name: true } } } },
        },
      }),
    ])

    const summary = {
      totalBilled:    agg._sum.amount     ?? 0,
      totalCollected: agg._sum.amountPaid ?? 0,
      outstanding:    agg._sum.balance    ?? 0,
      totalRecords:   agg._count._all,
    }

    const byStatus = byStatusRaw
      .map(s => ({
        status:    s.status,
        count:     s._count._all,
        billed:    s._sum.amount     ?? 0,
        collected: s._sum.amountPaid ?? 0,
      }))
      .sort((a, b) => b.billed - a.billed)

    // Aggregate by service and by month in one pass
    const serviceRevMap = {}
    const monthRevMap   = {}
    for (const b of billings) {
      const name  = b.appointment?.service?.name ?? 'Other'
      const month = b.createdAt.toISOString().slice(0, 7)

      if (!serviceRevMap[name])  serviceRevMap[name]  = { billed: 0, collected: 0 }
      if (!monthRevMap[month])   monthRevMap[month]   = { billed: 0, collected: 0 }

      serviceRevMap[name].billed    += b.amount
      serviceRevMap[name].collected += b.amountPaid
      monthRevMap[month].billed     += b.amount
      monthRevMap[month].collected  += b.amountPaid
    }
    const byService = Object.entries(serviceRevMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.billed - a.billed)
    const byMonth = Object.entries(monthRevMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }))

    return NextResponse.json({ summary, byStatus, byService, byMonth })
  }

  // ─── Patients ─────────────────────────────────────────────────────────────
  if (type === 'patients') {
    const allWhere   = { clinicId, isDeleted: false }
    const rangeWhere = { ...allWhere, ...dateRange('createdAt', dateFrom, dateTo) }

    const [total, newCount, byGenderRaw, newPatients] = await Promise.all([
      prisma.patient.count({ where: allWhere }),
      prisma.patient.count({ where: rangeWhere }),
      prisma.patient.groupBy({ by: ['gender'], where: allWhere, _count: { _all: true } }),
      prisma.patient.findMany({ where: rangeWhere, select: { createdAt: true } }),
    ])

    const summary = { total, newThisPeriod: newCount }

    const byGender = byGenderRaw
      .map(g => ({ gender: g.gender ?? 'UNSPECIFIED', count: g._count._all }))
      .sort((a, b) => b.count - a.count)

    const monthMap = {}
    for (const p of newPatients) {
      const month = p.createdAt.toISOString().slice(0, 7)
      monthMap[month] = (monthMap[month] ?? 0) + 1
    }
    const byMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))

    return NextResponse.json({ summary, byGender, byMonth })
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
}
