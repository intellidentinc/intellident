import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody } from '@/lib/validate'
import { generateReceiptNumber, computeBillingStatus } from '@/lib/billing'

async function getCaller() {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true, id: true },
  })
  if (!caller || ![ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.SUPERADMIN].includes(caller.role)) return null
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  return { ...caller, clinicId }
}

const VALID_SORT = ['createdAt', 'updatedAt', 'amount', 'amountPaid', 'balance']

export async function GET(request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page      = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const pageSize  = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10)))
  const sortField = VALID_SORT.includes(searchParams.get('sortField') ?? '') ? searchParams.get('sortField') : 'createdAt'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
  const status    = searchParams.get('status') ?? ''
  const dateFrom  = searchParams.get('dateFrom')
  const dateTo    = searchParams.get('dateTo')
  const search    = searchParams.get('search')?.trim() ?? ''

  const where = {
    clinicId: caller.clinicId,
    isDeleted: false,
    ...(status ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
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

  const [billings, total] = await Promise.all([
    prisma.billing.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        appointment: {
          select: {
            appointmentCode: true,
            scheduledAt: true,
            dentistId: true,
            service: { select: { name: true, price: true } },
            dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
        payments: { where: { isDeleted: false }, orderBy: { paidAt: 'asc' } },
      },
      orderBy: { [sortField]: sortOrder },
      skip: page * pageSize,
      take: pageSize,
    }),
    prisma.billing.count({ where }),
  ])

  return NextResponse.json({ billings, total })
}

export async function POST(request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const { appointmentId } = parsed.body
  if (!appointmentId) return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId: caller.clinicId, isDeleted: false },
    include: { service: { select: { price: true } } },
  })
  if (!appointment) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

  const existing = await prisma.billing.findUnique({ where: { appointmentId } })
  if (existing && !existing.isDeleted) {
    return NextResponse.json({ error: 'A billing record already exists for this appointment' }, { status: 409 })
  }

  const amount = appointment.service?.price ?? 0
  const receiptNumber = await generateReceiptNumber(caller.clinicId)

  const billing = await prisma.billing.create({
    data: {
      clinicId:      caller.clinicId,
      patientId:     appointment.patientId,
      appointmentId,
      amount,
      amountPaid:    0,
      balance:       amount,
      status:        'UNPAID',
      receiptNumber,
    },
    include: {
      patient:     { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      appointment: { select: { appointmentCode: true, scheduledAt: true, service: { select: { name: true, price: true } } } },
      payments:    { where: { isDeleted: false } },
    },
  })

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'CREATE', entity: 'Billing', entityId: billing.id, ipAddress: ip, userAgent, metadata: { amount, receiptNumber } })

  return NextResponse.json({ billing }, { status: 201 })
}
