import { isIP } from 'node:net'
import { prisma } from '@/lib/prisma'

/**
 * Extract IP + User-Agent from a Next.js request.
 * Call this before awaiting request.json() so the headers are still accessible.
 */
export function getRequestMeta(request) {
  const trustedProxy = process.env.VERCEL === '1' || process.env.TRUST_PROXY_HEADERS === 'true'
  const forwarded = trustedProxy ? request.headers.get('x-forwarded-for') : null
  const candidate = forwarded?.split(',').at(-1)?.trim()
  const ip = candidate && isIP(candidate) ? candidate : 'unknown'
  const userAgent = request.headers.get('user-agent')?.slice(0, 1024) || null
  return { ip, userAgent }
}

/**
 * Write an audit log entry. Always fire-and-forget — never throws.
 */
export function logAudit({ userId, clinicId, action, entity, entityId, ipAddress, userAgent, metadata }) {
  prisma.auditLog
    .create({
      data: {
        userId:    userId    ?? null,
        clinicId:  clinicId  ?? null,
        action,
        entity,
        entityId:  entityId  ? String(entityId) : null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata:  metadata  ?? undefined,
      },
    })
    .catch(() => {})
}
