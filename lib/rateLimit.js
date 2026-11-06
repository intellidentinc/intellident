import { prisma } from './prisma';

export async function checkRateLimit(key, maxRequests, windowSeconds) {
  return prisma.$transaction(async (transaction) => {
    const lockKey = 'rate:' + key;
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5(${lockKey}), 1, 16))::bit(64)::bigint)`;
    const now = new Date();
    await transaction.rateLimit.deleteMany({ where: { key, windowEnd: { lte: now } } });
    const windows = await transaction.rateLimit.findMany({ where: { key, windowEnd: { gt: now } } });
    const used = windows.reduce((total, window) => total + window.count, 0);
    if (used >= maxRequests) return { allowed: false, remaining: 0 };
    if (windows.length) {
      await transaction.rateLimit.update({ where: { id: windows[0].id }, data: { count: { increment: 1 } } });
    } else {
      await transaction.rateLimit.create({ data: { key, count: 1, windowEnd: new Date(now.getTime() + windowSeconds * 1000) } });
    }
    return { allowed: true, remaining: maxRequests - used - 1 };
  });
}
