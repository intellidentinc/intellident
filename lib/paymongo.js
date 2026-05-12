import crypto from 'crypto'

const BASE_URL = 'https://api.paymongo.com/v1'

function authHeader() {
  const key = process.env.PAYMONGO_SECRET_KEY ?? ''
  return 'Basic ' + Buffer.from(key + ':').toString('base64')
}

export async function createCheckoutSession({ lineItems, successUrl, cancelUrl, metadata = {} }) {
  const res = await fetch(`${BASE_URL}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          payment_method_types: ['card', 'gcash'],
          line_items: lineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata,
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.errors?.[0]?.detail ?? 'PayMongo checkout session creation failed')
  }

  const data = await res.json()
  return {
    checkoutSessionId: data.data.id,
    checkoutUrl: data.data.attributes.checkout_url,
  }
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET ?? ''
  if (!signatureHeader) return false

  // PayMongo signature format: "t=<timestamp>,te=<test_sig>,li=<live_sig>"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const idx = p.indexOf('=')
      return [p.slice(0, idx), p.slice(idx + 1)]
    })
  )

  const timestamp = parts.t
  if (!timestamp) return false

  const toSign = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(toSign).digest('hex')

  // Accept either test or live signature
  return parts.te === expected || parts.li === expected
}
