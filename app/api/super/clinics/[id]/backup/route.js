import { NextResponse } from 'next/server'
import { getSession, isStepUpValid, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { logAudit, getRequestMeta } from '@/lib/audit'

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const user = await getAuthContext()
  if (!user || user.role !== ROLES.SUPERADMIN) return null
  return session
}

export async function GET(request, { params }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!isStepUpValid(session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const { id: clinicId } = await params

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId, isDeleted: false },
    select: {
      id: true, name: true, code: true, email: true, phone: true,
      landline: true, address: true, logoUrl: true, isEnabled: true,
      passwordExpiryEnabled: true, passwordExpiryDays: true, passwordExpiryRoles: true, createdAt: true,
      schedule: {
        select: {
          workingDays: true, openTime: true, closeTime: true, updatedAt: true,
        },
      },
      closures: {
        where: { date: { gte: new Date() } },
        select: { id: true, date: true, reason: true },
        orderBy: { date: 'asc' },
      },
    },
  })

  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  const [patients, services, appointments, billing, auditLogs] = await Promise.all([
    prisma.patient.findMany({
      where: { clinicId, isDeleted: false },
      select: {
        id: true, patientCode: true, firstName: true, lastName: true,
        gender: true, dateOfBirth: true, phone: true, address: true,
        consentStatus: true, consentGivenAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.service.findMany({
      where: { clinicId, isDeleted: false },
      select: {
        id: true, name: true, description: true, duration: true,
        bufferTime: true, price: true, createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.appointment.findMany({
      where: { clinicId, isDeleted: false },
      select: {
        id: true, appointmentCode: true, scheduledAt: true, endsAt: true,
        status: true, notes: true, createdAt: true,
        patient: { select: { patientCode: true, firstName: true, lastName: true } },
        dentist: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
        service: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.billing.findMany({
      where: { clinicId, isDeleted: false },
      select: {
        id: true, receiptNumber: true, amount: true, amountPaid: true,
        balance: true, status: true, createdAt: true,
        patient: { select: { patientCode: true, firstName: true, lastName: true } },
        appointment: { select: { appointmentCode: true } },
        payments: {
          select: { id: true, amount: true, method: true, paidAt: true, paymongoPaymentId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { clinicId },
      select: {
        id: true, action: true, entity: true, entityId: true,
        ipAddress: true, createdAt: true,
        user: { select: { email: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
  ])

  const backup = {
    _meta: {
      generatedAt: new Date().toISOString(),
      generatedBy: session.userId,
      clinicId,
      schemaVersion: '1.0',
      note: 'Patient dental records (PatientRecord) are excluded — they are end-to-end encrypted and the server never holds plaintext.',
    },
    clinic,
    patients,
    services,
    appointments,
    billing,
    auditLogs,
  }

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({
    userId: session.userId,
    clinicId,
    action: 'BACKUP',
    entity: 'Clinic',
    entityId: clinicId,
    ipAddress: ip,
    userAgent,
    metadata: {
      counts: {
        patients: patients.length,
        services: services.length,
        appointments: appointments.length,
        billingRecords: billing.length,
        auditLogRows: auditLogs.length,
      },
    },
  })

  const filename = `intellident-backup-${clinic.code}-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
