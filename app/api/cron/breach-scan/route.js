import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { ROLES } from '@/lib/roles'
import { sendBreachAlertEmail } from '@/lib/email'

const WINDOW_MS             = 24 * 60 * 60 * 1000
const BRUTE_FORCE_THRESHOLD = 3   // distinct accounts locked from same IP
const MASS_VIEW_THRESHOLD   = 100 // patient records viewed by one user
const BULK_EXPORT_THRESHOLD = 5   // exports by one user

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - WINDOW_MS)

  const [lockouts, views, exports_] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: 'LOCKOUT', createdAt: { gte: windowStart }, ipAddress: { not: null } },
      select: { ipAddress: true, userId: true, clinicId: true },
    }),
    prisma.auditLog.findMany({
      where: { action: 'VIEW', entity: 'PatientRecord', createdAt: { gte: windowStart } },
      select: { userId: true, clinicId: true },
    }),
    prisma.auditLog.findMany({
      where: { action: 'EXPORT', createdAt: { gte: windowStart } },
      select: { userId: true, clinicId: true },
    }),
  ])

  const alerts = []

  // Pattern A — distributed brute force: same IP locking multiple accounts
  const byIp = {}
  for (const row of lockouts) {
    if (!row.ipAddress) continue
    if (!byIp[row.ipAddress]) byIp[row.ipAddress] = { userIds: new Set(), clinicIds: new Set() }
    if (row.userId)   byIp[row.ipAddress].userIds.add(row.userId)
    if (row.clinicId) byIp[row.ipAddress].clinicIds.add(row.clinicId)
  }
  for (const [ip, { userIds, clinicIds }] of Object.entries(byIp)) {
    if (userIds.size >= BRUTE_FORCE_THRESHOLD) {
      alerts.push({
        pattern: 'DISTRIBUTED_BRUTE_FORCE',
        severity: 'CRITICAL',
        clinicIds: [...clinicIds],
        details: { ipAddress: ip, lockedAccountCount: userIds.size },
      })
    }
  }

  // Pattern B — mass patient record access
  const viewCounts = {}
  for (const row of views) {
    const key = `${row.userId}:${row.clinicId}`
    viewCounts[key] = (viewCounts[key] ?? 0) + 1
  }
  for (const [key, count] of Object.entries(viewCounts)) {
    if (count > MASS_VIEW_THRESHOLD) {
      const [userId, clinicId] = key.split(':')
      alerts.push({
        pattern: 'MASS_RECORD_ACCESS',
        severity: 'HIGH',
        clinicIds: [clinicId],
        details: { userId, recordsViewed: count },
      })
    }
  }

  // Pattern C — bulk export
  const exportCounts = {}
  for (const row of exports_) {
    const key = `${row.userId}:${row.clinicId}`
    exportCounts[key] = (exportCounts[key] ?? 0) + 1
  }
  for (const [key, count] of Object.entries(exportCounts)) {
    if (count >= BULK_EXPORT_THRESHOLD) {
      const [userId, clinicId] = key.split(':')
      alerts.push({
        pattern: 'BULK_EXPORT',
        severity: 'HIGH',
        clinicIds: [clinicId],
        details: { userId, exportCount: count },
      })
    }
  }

  if (alerts.length === 0) {
    return NextResponse.json({ alertsGenerated: 0, checkedAt: now.toISOString() })
  }

  // Batch-fetch admin users and clinic names for all affected clinics
  const allClinicIds = [...new Set(alerts.flatMap((a) => a.clinicIds))]
  const [adminUsers, clinics] = await Promise.all([
    prisma.user.findMany({
      where: { clinicId: { in: allClinicIds }, role: ROLES.ADMIN, isDeleted: false, isActive: true },
      select: { email: true, firstName: true, clinicId: true },
    }),
    prisma.clinic.findMany({
      where: { id: { in: allClinicIds } },
      select: { id: true, name: true },
    }),
  ])

  const clinicNameMap = Object.fromEntries(clinics.map((c) => [c.id, c.name]))
  const adminsByClinic = {}
  for (const admin of adminUsers) {
    if (!adminsByClinic[admin.clinicId]) adminsByClinic[admin.clinicId] = []
    adminsByClinic[admin.clinicId].push(admin)
  }

  for (const alert of alerts) {
    for (const clinicId of alert.clinicIds) {
      logAudit({
        userId: null,
        clinicId,
        action: 'BREACH_ALERT',
        entity: 'BreachDetection',
        entityId: clinicId,
        metadata: { pattern: alert.pattern, severity: alert.severity, details: alert.details },
      })

      const clinicName = clinicNameMap[clinicId] ?? clinicId
      for (const admin of adminsByClinic[clinicId] ?? []) {
        sendBreachAlertEmail({
          to: admin.email,
          adminFirstName: admin.firstName,
          breachType: alert.pattern,
          details: alert.details,
          clinicName,
          detectedAt: now,
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ alertsGenerated: alerts.length, checkedAt: now.toISOString() })
}
