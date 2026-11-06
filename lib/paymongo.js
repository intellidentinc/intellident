import crypto from 'crypto'
import { secureEqual } from '@/lib/secureCompare'

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
          payment_method_types: (process.env.PAYMONGO_SECRET_KEY ?? '').startsWith('sk_live_')
            ? ['card', 'gcash', 'paymaya', 'qrph', 'dob', 'brankas_landbank', 'brankas_metrobank']
            : ['card', 'gcash', 'qrph'],
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
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET
  // Fail closed: without a configured secret, never accept a webhook.
  if (!secret) return false
  if (!signatureHeader) return false

  // PayMongo signature format: "t=<timestamp>,te=<test_sig>,li=<live_sig>"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const segment = part.trim()
      const idx = segment.indexOf('=')
      return [segment.slice(0, idx), segment.slice(idx + 1)]
    })
  )

  const timestamp = parts.t
  if (!timestamp || !/^\d+$/.test(timestamp) || !Number.isSafeInteger(Number(timestamp))) return false

  // Reject replayed webhooks older than 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false

  const toSign = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(toSign).digest('hex')

  const signature = (process.env.PAYMONGO_SECRET_KEY ?? '').startsWith('sk_live_') ? parts.li : parts.te
  return secureEqual(signature ?? '', expected)
}
