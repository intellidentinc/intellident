import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/cron-auth'

/**
 * GET /api/cron/audit-purge — Vercel Cron Job (daily at 01:00 UTC)
 *
 * For each clinic with retention days configured, permanently hard-deletes:
 *   - Audit log entries older than auditLogRetentionDays
 *   - Soft-deleted patient records (+ their history/attachments) older than patientRecordRetentionDays
 *   - Soft-deleted billing records (+ their payments) older than billingRetentionDays
 */
export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clinics = await prisma.clinic.findMany({
    where: {
      isDeleted: false,
      OR: [
        { auditLogRetentionDays: { not: null } },
        { patientRecordRetentionDays: { not: null } },
        { billingRetentionDays: { not: null } },
      ],
    },
    select: {
      id: true,
      auditLogRetentionDays: true,
      patientRecordRetentionDays: true,
      billingRetentionDays: true,
    },
  })

  let totalAuditDeleted = 0
  let totalRecordsDeleted = 0
  let totalBillingDeleted = 0

  for (const clinic of clinics) {
    // Audit logs
    if (clinic.auditLogRetentionDays != null) {
      const cutoff = new Date(Date.now() - clinic.auditLogRetentionDays * 86_400_000)
      const { count } = await prisma.auditLog.deleteMany({
        where: { clinicId: clinic.id, createdAt: { lt: cutoff } },
      })
      totalAuditDeleted += count
    }

    // Patient records — cascade children before parent (no DB-level cascade)
    if (clinic.patientRecordRetentionDays != null) {
      const cutoff = new Date(Date.now() - clinic.patientRecordRetentionDays * 86_400_000)
      const records = await prisma.patientRecord.findMany({
        where: { clinicId: clinic.id, isDeleted: true, deletedAt: { lt: cutoff } },
        select: { id: true },
      })
      const recordIds = records.map((r) => r.id)

      if (recordIds.length > 0) {
        await prisma.$transaction([
          prisma.recordHistory.deleteMany({ where: { recordId: { in: recordIds } } }),
          prisma.attachment.deleteMany({ where: { recordId: { in: recordIds } } }),
          prisma.patientRecord.deleteMany({ where: { id: { in: recordIds } } }),
        ])
        totalRecordsDeleted += recordIds.length
      }
    }

    // Billing records — cascade payments before billing (no DB-level cascade)
    if (clinic.billingRetentionDays != null) {
      const cutoff = new Date(Date.now() - clinic.billingRetentionDays * 86_400_000)
      const billings = await prisma.billing.findMany({
        where: { clinicId: clinic.id, isDeleted: true, deletedAt: { lt: cutoff } },
        select: { id: true },
      })
      const billingIds = billings.map((b) => b.id)

      if (billingIds.length > 0) {
        await prisma.$transaction([
          prisma.payment.deleteMany({ where: { billingId: { in: billingIds } } }),
          prisma.billing.deleteMany({ where: { id: { in: billingIds } } }),
        ])
        totalBillingDeleted += billingIds.length
      }
    }
  }

  return NextResponse.json({ clinicsProcessed: clinics.length, totalAuditDeleted, totalRecordsDeleted, totalBillingDeleted })
}
