import { prisma } from '@/lib/prisma'

// tx must be a Prisma transaction client — the advisory lock is released automatically
// when that transaction commits or rolls back, making the count + caller's write atomic.
export async function generateReceiptNumber(clinicId, tx) {
  const client = tx ?? prisma
  await client.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5(${clinicId}), 1, 16))::bit(64)::bigint)`

  const clinic = await client.clinic.findUnique({
    where: { id: clinicId },
    select: { code: true },
  })
  const code = clinic?.code ?? 'CLN'
  const year = new Date().getFullYear()

  const count = await client.billing.count({
    where: {
      clinicId,
      receiptNumber: { not: null },
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  })

  return `RCP-${code}-${year}-${String(count + 1).padStart(5, '0')}`
}

export function computeBillingStatus(amountPaid, totalAmount) {
  if (amountPaid <= 0) return 'UNPAID'
  if (amountPaid >= totalAmount) return 'PAID'
  return 'PARTIAL'
}
