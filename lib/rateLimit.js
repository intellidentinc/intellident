import { prisma } from './prisma';

/**
 * IP-based rate limiter backed by the RateLimit table.
 * Safe across multiple Vercel function instances (unlike in-memory solutions).
 *
 * @param {string} key         - Unique identifier, e.g. "ip:sign-in"
 * @param {number} maxRequests - Maximum allowed requests within the window
 * @param {number} windowSeconds - Sliding window duration in seconds
 * @returns {{ allowed: boolean, remaining: number }}
 */
export async function checkRateLimit(key, maxRequests, windowSeconds) {
  const now = new Date();

  // Clean up expired entries for this key (fire-and-forget)
  prisma.rateLimit.deleteMany({ where: { key, windowEnd: { lte: now } } }).catch(() => {});

  const existing = await prisma.rateLimit.findFirst({
    where: { key, windowEnd: { gt: now } },
  });

  if (!existing) {
    await prisma.rateLimit
      .create({ data: { key, count: 1, windowEnd: new Date(now.getTime() + windowSeconds * 1000) } })
      .catch(() => {});
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  await prisma.rateLimit
    .update({ where: { id: existing.id }, data: { count: { increment: 1 } } })
    .catch(() => {});

  return { allowed: true, remaining: maxRequests - existing.count - 1 };
}
