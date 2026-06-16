import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str } from '@/lib/validate'
import { computeBillingStatus, generateReceiptNumber } from '@/lib/billing'

async function getStaffCaller() {
  const session = await getSession()
  if (!session) return null
  const caller = await getAuthContext()
  if (!caller || ![ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.SUPERADMIN].includes(caller.role)) return null
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  return { ...caller, clinicId, isStaff: true }
}

async function getPatientCaller() {
  const session = await getSession()
  if (!session) return null
  const user = await getAuthContext()
  if (!user || user.role !== ROLES.PATIENT) return null
  const patient = await prisma.patient.findUnique({ where: { userId: session.userId } })
  if (!patient || patient.clinicId !== user.clinicId) return null
  return { role: user.role, clinicId: user.clinicId, patientId: patient.id, userId: session.userId, isStaff: false }
}

const BILLING_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
  appointment: {
    select: {
      appointmentCode: true,
      scheduledAt: true,
      service: { select: { name: true, price: true } },
      dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  },
  payments: { where: { isDeleted: false }, orderBy: { paidAt: 'asc' } },
}

export async function GET(request, { params }) {
  const { id } = await params

  // Try staff first, then patient
  let caller = await getStaffCaller()
  let isStaff = true
  if (!caller) {
    caller = await getPatientCaller()
    isStaff = false
  }
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const billing = await prisma.billing.findFirst({
    where: { id, clinicId: caller.clinicId, isDeleted: false },
    include: BILLING_INCLUDE,
  })
  if (!billing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Patients may only view their own billing
  if (!isStaff && billing.patientId !== caller.patientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Backfill receiptNumber for billings created before generation was wired up
  if (!billing.receiptNumber) {
    await prisma.$transaction(async (tx) => {
      const receiptNumber = await generateReceiptNumber(billing.clinicId, tx)
      await tx.billing.update({ where: { id: billing.id }, data: { receiptNumber } })
      billing.receiptNumber = receiptNumber
    })
  }

  return NextResponse.json({ billing })
}

export async function PATCH(request, { params }) {
  const caller = await getStaffCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const { id } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const billing = await prisma.billing.findFirst({
    where: { id, clinicId: caller.clinicId, isDeleted: false },
    include: { payments: { where: { isDeleted: false } } },
  })
  if (!billing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Manual refund
  if (parsed.body.status === 'REFUNDED') {
    const updated = await prisma.billing.update({
      where: { id },
      data: { status: 'REFUNDED' },
      include: BILLING_INCLUDE,
    })
    logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'UPDATE', entity: 'Billing', entityId: id, ipAddress: ip, userAgent, metadata: { status: 'REFUNDED' } })
    return NextResponse.json({ billing: updated })
  }

  // Cash payment recording
  const rawAmount = parseFloat(parsed.body.amount)
  if (isNaN(rawAmount) || rawAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (rawAmount > billing.balance + 0.001) {
    return NextResponse.json({ error: `Amount cannot exceed the outstanding balance of ₱${billing.balance.toFixed(2)}` }, { status: 400 })
  }
  if (billing.status === 'PAID' || billing.status === 'REFUNDED') {
    return NextResponse.json({ error: 'This billing is already settled' }, { status: 400 })
  }

  const notes  = str(parsed.body.notes, 500)
  const method = str(parsed.body.method, 50) ?? 'CASH'

  const newAmountPaid = billing.amountPaid + rawAmount
  const newBalance    = Math.max(0, billing.balance - rawAmount)
  const newStatus     = computeBillingStatus(newAmountPaid, billing.amount)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: { billingId: id, amount: rawAmount, method, notes: notes || null, type: 'FULL' },
    })

    const data = { amountPaid: newAmountPaid, balance: newBalance, status: newStatus }
    if (newStatus === 'PAID' && !billing.receiptNumber) {
      data.receiptNumber = await generateReceiptNumber(caller.clinicId, tx)
    }

    return tx.billing.update({ where: { id }, data, include: BILLING_INCLUDE })
  })

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'CREATE', entity: 'Payment', entityId: id, ipAddress: ip, userAgent, metadata: { amount: rawAmount, method, newStatus } })

  return NextResponse.json({ billing: updated })
}
