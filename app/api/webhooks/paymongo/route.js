import { NextResponse, after } from 'next/server'
import { verifyWebhookSignature } from '@/lib/paymongo'
import { recordPayment } from '@/lib/payments'
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
  const paymentType = ['FULL', 'RESERVATION', 'PARTIAL'].includes(metadata.paymentType) ? metadata.paymentType : 'FULL'

  // Extract PayMongo payment details
  const pmPayments = attrs.payments ?? []
  const pmPayment  = pmPayments[0]
  if (!pmPayment || !billingId) {
    return NextResponse.json({ received: true })
  }

  const paymongoPaymentId         = pmPayment.id
  const paymongoCheckoutSessionId = event.data.attributes.data?.id
  const amountInCentavos          = pmPayment.attributes?.amount ?? 0
  const amount                    = amountInCentavos / 100

  if (typeof billingId !== 'string' || typeof clinicId !== 'string' || typeof paymongoPaymentId !== 'string' || !Number.isSafeInteger(amountInCentavos) || amountInCentavos <= 0) {
    return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 })
  }
  const result = await recordPayment({
    billingId, clinicId, amount, method: 'PAYMONGO', type: paymentType,
    paymongoPaymentId, paymongoCheckoutSessionId,
  })
  if (result.duplicate) return NextResponse.json({ received: true })
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })
  const { billing } = result

  // Fire-and-forget: notify patient
  const patientUser = billing.patient?.user
  if (patientUser?.id) {
    after(
      createNotification({
        userId:        patientUser.id,
        clinicId:      clinicId ?? billing.clinicId,
        type:          'PAYMENT_RECEIVED',
        title:         'Payment Confirmed',
        body:          `Your payment of ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been received.`,
        appointmentId: billing.appointmentId,
      }).catch((err) => console.error('createNotification (PAYMENT_RECEIVED) failed:', err))
    )
  }

  logAudit({ userId: null, clinicId: clinicId ?? billing.clinicId, action: 'CREATE', entity: 'Payment', entityId: billingId, ipAddress: null, userAgent: 'paymongo-webhook', metadata: { amount, paymentType, paymongoPaymentId } })

  return NextResponse.json({ received: true })
}
