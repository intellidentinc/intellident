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

  // Atomic check-and-increment: the WHERE embeds the limit guard so no concurrent
  // request can slip through between the read and the write (eliminates TOCTOU).
  const rowsUpdated = await prisma.$executeRaw`
    UPDATE rate_limits
    SET count = count + 1
    WHERE key = ${key}
      AND "windowEnd" > ${now}
      AND count < ${maxRequests}
  `;

  if (rowsUpdated > 0) {
    const record = await prisma.rateLimit.findFirst({
      where: { key, windowEnd: { gt: now } },
      select: { count: true },
    });
    return { allowed: true, remaining: Math.max(0, maxRequests - (record?.count ?? maxRequests)) };
  }

  // No rows updated — either limit is exhausted or no active window exists yet.
  const existing = await prisma.rateLimit.findFirst({
    where: { key, windowEnd: { gt: now } },
    select: { count: true },
  });

  if (existing) {
    return { allowed: false, remaining: 0 };
  }

  // First request in a new window — create the record.
  // .catch absorbs the benign race when two concurrent first-requests both try to create.
  await prisma.rateLimit
    .create({ data: { key, count: 1, windowEnd: new Date(now.getTime() + windowSeconds * 1000) } })
    .catch(() => {});

  return { allowed: true, remaining: maxRequests - 1 };
}
