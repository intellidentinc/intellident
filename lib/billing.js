import { prisma } from '@/lib/prisma'

// tx must be a Prisma transaction client — the advisory lock is released automatically
// when that transaction commits or rolls back, making the lookup + caller's write atomic.
export async function generateReceiptNumber(clinicId, tx) {
  const client = tx ?? prisma
  await client.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5(${clinicId}), 1, 16))::bit(64)::bigint)`

  const clinic = await client.clinic.findUnique({
    where: { id: clinicId },
    select: { code: true },
  })
  const code = clinic?.code ?? 'CLN'
  const year = new Date().getFullYear()
  const prefix = `RCP-${code}-${year}-`

  // Base the next number on the highest existing sequence for this clinic/year,
  // not a count — counts collide whenever the sequence has gaps (e.g. a record
  // whose receiptNumber was cleared or removed after being issued).
  const last = await client.billing.findFirst({
    where: { clinicId, receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true },
  })
  const lastSeq = last ? parseInt(last.receiptNumber.slice(prefix.length), 10) || 0 : 0

  return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`
}

export function computeBillingStatus(amountPaid, totalAmount) {
  if (amountPaid <= 0) return 'UNPAID'
  if (amountPaid >= totalAmount) return 'PAID'
  return 'PARTIAL'
}

// Applies the paid reservation deposit as a credited payment on a newly created
// SERVICE billing. Must be called inside a Prisma transaction (tx).
// If reservationFeeDeductible is false on the clinic, this is a no-op.
export async function applyReservationCredit(tx, clinicId, appointmentId, newServiceBillingId, serviceAmount) {
  const clinic = await tx.clinic.findUnique({
    where: { id: clinicId },
    select: { reservationFeeDeductible: true },
  })
  if (!clinic?.reservationFeeDeductible) return

  const resBilling = await tx.billing.findFirst({
    where: { appointmentId, billingType: 'RESERVATION', isDeleted: false },
    select: { id: true, amountPaid: true },
  })
  const reservationPaid = resBilling?.amountPaid ?? 0
  if (reservationPaid <= 0) return

  const credited = Math.min(reservationPaid, serviceAmount)
  const newAmountPaid = credited
  const newBalance = Math.max(0, serviceAmount - credited)
  const newStatus = computeBillingStatus(newAmountPaid, serviceAmount)

  await tx.payment.create({
    data: {
      billingId: newServiceBillingId,
      amount: credited,
      method: 'Reservation Deposit',
      type: 'RESERVATION',
      notes: 'Credited from reservation deposit',
    },
  })

  await tx.billing.update({
    where: { id: newServiceBillingId },
    data: { amountPaid: newAmountPaid, balance: newBalance, status: newStatus },
  })
}
