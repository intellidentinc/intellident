import { prisma } from '@/lib/prisma'

/**
 * Extract IP + User-Agent from a Next.js request.
 * Call this before awaiting request.json() so the headers are still accessible.
 */
export function getRequestMeta(request) {
  // Use the rightmost X-Forwarded-For value (set by Vercel infra, not forgeable by clients)
  // rather than the leftmost (client-supplied) to prevent rate-limit bypass via IP spoofing.
  const forwarded = request.headers.get('x-forwarded-for')
  const ip =
    (forwarded ? forwarded.split(',').at(-1)?.trim() : null) ||
    request.headers.get('x-real-ip') ||
    null
  const userAgent = request.headers.get('user-agent') || null
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
