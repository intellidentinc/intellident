import { secureEqual } from '@/lib/secureCompare'

/**
 * Authorize a cron/health request via the CRON_SECRET Bearer token.
 * Fails closed: if CRON_SECRET is unset/empty, no request is authorized
 * (prevents the `Bearer undefined` bypass). Uses constant-time comparison.
 */
export function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return secureEqual(token, secret)
}
