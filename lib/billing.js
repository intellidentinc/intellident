import { prisma } from '@/lib/prisma'

export async function generateReceiptNumber(clinicId) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { code: true },
  })
  const code = clinic?.code ?? 'CLN'
  const year = new Date().getFullYear()

  const count = await prisma.billing.count({
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
