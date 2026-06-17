import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { createCheckoutSession } from '@/lib/paymongo'

async function getCaller() {
  const session = await getSession()
  if (!session) return null
  const user = await getAuthContext()
  if (!user) return null

  if ([ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.SUPERADMIN].includes(user.role)) {
    const clinicId = user.role === ROLES.SUPERADMIN ? session.clinicId : user.clinicId
    return { role: user.role, clinicId, isStaff: true }
  }

  if (user.role === ROLES.PATIENT) {
    const patient = await prisma.patient.findUnique({ where: { userId: session.userId } })
    if (!patient || patient.clinicId !== user.clinicId) return null
    return { role: user.role, clinicId: user.clinicId, patientId: patient.id, isStaff: false }
  }

  return null
}

export async function POST(request, { params }) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const billing = await prisma.billing.findFirst({
    where: { id, clinicId: caller.clinicId, isDeleted: false },
    include: {
      appointment: {
        select: { service: { select: { name: true } } },
      },
    },
  })
  if (!billing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Patients may only pay their own billing
  if (!caller.isStaff && billing.patientId !== caller.patientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (billing.status === 'PAID') {
    return NextResponse.json({ error: 'This billing has already been fully paid' }, { status: 400 })
  }
  if (billing.status === 'REFUNDED') {
    return NextResponse.json({ error: 'This billing has been refunded' }, { status: 400 })
  }

  const payableAmount = billing.balance
  if (payableAmount <= 0) {
    return NextResponse.json({ error: 'No outstanding balance to pay' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const serviceName = billing.appointment?.service?.name ?? 'Dental Service'
  const isReservation = billing.billingType === 'RESERVATION'
  const lineItemName = isReservation ? `Reservation Deposit — ${serviceName}` : serviceName

  const { checkoutUrl } = await createCheckoutSession({
    lineItems: [
      {
        amount:   Math.round(payableAmount * 100),
        currency: 'PHP',
        name:     lineItemName,
        quantity: 1,
      },
    ],
    successUrl: `${appUrl}/${caller.clinicId}/my-billing?payment=success&billingId=${id}`,
    cancelUrl:  `${appUrl}/${caller.clinicId}/my-billing`,
    metadata:   { billingId: id, clinicId: caller.clinicId, paymentType: isReservation ? 'RESERVATION' : 'FULL' },
  })

  return NextResponse.json({ checkoutUrl })
}
