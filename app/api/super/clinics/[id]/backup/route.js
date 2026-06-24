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
        // Export ALL closures (not just future) so the backup is round-trippable.
        select: { id: true, clinicId: true, date: true, reason: true, createdAt: true },
        orderBy: { date: 'asc' },
      },
    },
  })

  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  const [users, dentists, receptionists, patients, services, appointments, billing, auditLogs] = await Promise.all([
    // User rows carry only NON-PLAINTEXT credential material: bcrypt hashes and
    // password-derived-encrypted key blobs. Restoring them verbatim preserves login + E2EE.
    prisma.user.findMany({
      where: { clinicId },
      select: {
        id: true, email: true, firstName: true, middleInitial: true, lastName: true,
        phone: true, address: true, dateOfBirth: true, gender: true,
        password: true, passwordHistory: true, role: true,
        wrappedKey: true, keySalt: true, publicKey: true, encryptedPrivateKey: true, privateKeyIv: true,
        clinicId: true, isActive: true, username: true, mustChangePassword: true,
        passwordExpiresAt: true, termsAcceptedAt: true, isDeleted: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.dentist.findMany({
      where: { clinicId },
      select: { id: true, userId: true, clinicId: true, specialty: true, isDeleted: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.receptionist.findMany({
      where: { clinicId },
      select: { id: true, userId: true, clinicId: true, isDeleted: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.patient.findMany({
      where: { clinicId },
      select: {
        id: true, userId: true, clinicId: true, patientCode: true, firstName: true, lastName: true,
        gender: true, dateOfBirth: true, phone: true, address: true,
        consentStatus: true, consentGivenAt: true, isDeleted: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.service.findMany({
      where: { clinicId },
      select: {
        id: true, clinicId: true, name: true, description: true, duration: true,
        bufferTime: true, price: true, isDeleted: true, createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.appointment.findMany({
      where: { clinicId },
      select: {
        id: true, clinicId: true, patientId: true, serviceId: true, dentistId: true,
        appointmentCode: true, scheduledAt: true, endsAt: true,
        status: true, notes: true, aiSuggested: true,
        reminderSent24h: true, reminderSent2h: true, isDeleted: true,
        createdAt: true, updatedAt: true,
        services: { select: { serviceId: true, order: true } },
        // Denormalized display fields — human readability only, ignored on restore.
        patient: { select: { patientCode: true, firstName: true, lastName: true } },
        dentist: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
        service: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.billing.findMany({
      where: { clinicId },
      select: {
        id: true, clinicId: true, patientId: true, appointmentId: true, billingType: true,
        receiptNumber: true, amount: true, amountPaid: true, balance: true, status: true,
        isDeleted: true, createdAt: true,
        payments: {
          select: {
            id: true, billingId: true, amount: true, method: true, notes: true, type: true,
            paymongoCheckoutSessionId: true, paymongoPaymentId: true, paidAt: true, isDeleted: true, createdAt: true,
          },
        },
        // Denormalized display fields — human readability only, ignored on restore.
        patient: { select: { patientCode: true, firstName: true, lastName: true } },
        appointment: { select: { appointmentCode: true } },
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
      schemaVersion: '2.0',
      containsCredentials: true,
      note: 'Round-trippable snapshot for in-app restore. Contains User rows with bcrypt password hashes and password-derived-encrypted key blobs (NO plaintext). Patient dental records (PatientRecord) and their RecordKey envelopes are excluded — they are end-to-end encrypted and the server never holds plaintext. Audit logs are exported for reference but are NOT re-imported on restore.',
    },
    clinic,
    users,
    dentists,
    receptionists,
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
        users: users.length,
        dentists: dentists.length,
        receptionists: receptionists.length,
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
