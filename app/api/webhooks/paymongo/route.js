import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/paymongo'
import { computeBillingStatus } from '@/lib/billing'
import { createNotification } from '@/lib/notifications'
import { logAudit } from '@/lib/audit'

export async function POST(request) {
  const rawBody = await request.text()
  const sig = request.headers.get('paymongo-signature')

  if (!verifyWebhookSignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = event?.data?.attributes?.type
  if (eventType !== 'checkout_session.payment.paid') {
    return NextResponse.json({ received: true })
  }

  const attrs      = event.data.attributes.data?.attributes ?? {}
  const metadata   = attrs.metadata ?? {}
  const billingId  = metadata.billingId
  const clinicId   = metadata.clinicId
  const paymentType = metadata.paymentType ?? 'FULL'

  // Extract PayMongo payment details
  const pmPayments = attrs.payments ?? []
  const pmPayment  = pmPayments[0]
  if (!pmPayment || !billingId) {
    return NextResponse.json({ received: true })
  }

  const paymongoPaymentId         = pmPayment.id
  const paymongoCheckoutSessionId = event.data.id
  const amountInCentavos          = pmPayment.attributes?.amount ?? 0
  const amount                    = amountInCentavos / 100

  // Idempotency — skip if already processed
  const existing = await prisma.payment.findFirst({
    where: { paymongoPaymentId },
  })
  if (existing) return NextResponse.json({ received: true })

  // Load billing
  const billing = await prisma.billing.findFirst({
    where: { id: billingId, isDeleted: false },
    include: {
      patient: {
        include: { user: { select: { id: true, firstName: true } } },
      },
    },
  })
  if (!billing || billing.status === 'PAID' || billing.status === 'REFUNDED') {
    return NextResponse.json({ received: true })
  }

  const newAmountPaid = billing.amountPaid + amount
  const newBalance    = Math.max(0, billing.balance - amount)
  const newStatus     = computeBillingStatus(newAmountPaid, billing.amount)

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        billingId,
        amount,
        method: 'PAYMONGO',
        type: paymentType,
        paymongoCheckoutSessionId,
        paymongoPaymentId,
      },
    }),
    prisma.billing.update({
      where: { id: billingId },
      data: { amountPaid: newAmountPaid, balance: newBalance, status: newStatus },
    }),
  ])

  // Fire-and-forget: notify patient
  const patientUser = billing.patient?.user
  if (patientUser?.id) {
    createNotification({
      userId:        patientUser.id,
      clinicId:      clinicId ?? billing.clinicId,
      type:          'PAYMENT_RECEIVED',
      title:         'Payment Confirmed',
      body:          `Your payment of ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been received.`,
      appointmentId: billing.appointmentId,
    }).catch(() => {})
  }

  logAudit({ userId: null, clinicId: clinicId ?? billing.clinicId, action: 'CREATE', entity: 'Payment', entityId: billingId, ipAddress: null, userAgent: 'paymongo-webhook', metadata: { amount, paymentType, paymongoPaymentId } })

  return NextResponse.json({ received: true })
}
