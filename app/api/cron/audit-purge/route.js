import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/cron/audit-purge — Vercel Cron Job (daily at 01:00 UTC)
 *
 * For each clinic with auditLogRetentionDays set, permanently deletes audit log
 * entries older than the configured threshold.
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clinics = await prisma.clinic.findMany({
    where: { isDeleted: false, auditLogRetentionDays: { not: null } },
    select: { id: true, auditLogRetentionDays: true },
  })

  let totalDeleted = 0

  for (const clinic of clinics) {
    const cutoff = new Date(Date.now() - clinic.auditLogRetentionDays * 86_400_000)
    const { count } = await prisma.auditLog.deleteMany({
      where: { clinicId: clinic.id, createdAt: { lt: cutoff } },
    })
    totalDeleted += count
  }

  return NextResponse.json({ clinicsProcessed: clinics.length, totalDeleted })
}
