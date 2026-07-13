import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateReceiptNumber } from '@/lib/billing'
import { getActivePatientContext } from '@/lib/patient-context'

async function getPatientCaller() {
  return getActivePatientContext()
}

export async function GET() {
  const caller = await getPatientCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const billings = await prisma.billing.findMany({
    where: { patientId: caller.patientId, isDeleted: false },
    include: {
      patient: { select: { firstName: true, lastName: true, patientCode: true } },
      appointment: {
        select: {
          appointmentCode: true,
          scheduledAt: true,
          service: { select: { name: true, price: true } },
          dentist: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        },
      },
      payments: { where: { isDeleted: false }, orderBy: { paidAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Backfill receiptNumber for billings created before generation was wired up
  for (const billing of billings) {
    if (!billing.receiptNumber) {
      await prisma.$transaction(async (tx) => {
        const receiptNumber = await generateReceiptNumber(billing.clinicId, tx)
        await tx.billing.update({ where: { id: billing.id }, data: { receiptNumber } })
        billing.receiptNumber = receiptNumber
      })
    }
  }

  return NextResponse.json({ billings })
}
