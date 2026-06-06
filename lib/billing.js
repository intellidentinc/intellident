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
