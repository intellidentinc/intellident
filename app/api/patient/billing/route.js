import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { generateReceiptNumber } from '@/lib/billing'

async function getPatientCaller() {
  const session = await getSession()
  if (!session) return null
  const user = await getAuthContext()
  if (!user || user.role !== ROLES.PATIENT) return null
  const patient = await prisma.patient.findUnique({ where: { userId: session.userId } })
  if (!patient || patient.clinicId !== user.clinicId) return null
  return { clinicId: user.clinicId, patientId: patient.id }
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
