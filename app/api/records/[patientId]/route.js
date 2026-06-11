import { NextResponse } from 'next/server'
import { getSession, isStepUpValid } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { parseJsonBody, str, secret } from '@/lib/validate'
import { logAudit, getRequestMeta } from '@/lib/audit'
import { getRecordRecipients, validateWraps } from '@/lib/records-access'

async function getDentistForClinic(session) {
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })
  if (!caller || caller.role !== ROLES.DENTIST) return null

  const dentist = await prisma.dentist.findUnique({
    where: { userId: session.userId },
    select: { id: true, clinicId: true }
  })
  if (!dentist || dentist.clinicId !== caller.clinicId) return null

  return { ...caller, dentistId: dentist.id }
}

// GET /api/records/[patientId] — list records for a patient
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isStepUpValid(session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const dentist = await getDentistForClinic(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId } = await params

  // Ensure patient belongs to same clinic and has appointment with this dentist
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      clinicId: dentist.clinicId,
      isDeleted: false,
      appointments: {
        some: { dentistId: dentist.dentistId, isDeleted: false, status: { in: ['CONFIRMED', 'COMPLETED'] } }
      }
    },
    select: { id: true, firstName: true, lastName: true, patientCode: true }
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const records = await prisma.patientRecord.findMany({
    where: { patientId, clinicId: dentist.clinicId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, encryptedData: true, dataIv: true, contentHash: true, status: true, createdAt: true, updatedAt: true,
      _count: { select: { attachments: { where: { isDeleted: false } } } }
    }
  })

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId: dentist.clinicId, action: 'VIEW', entity: 'PatientRecord', entityId: patientId, ipAddress: ip, userAgent })
  return NextResponse.json({ patient, records })
}

// POST /api/records/[patientId] — create a record
export async function POST(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getDentistForClinic(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const title         = str(parsed.body.title, 200)
  const encryptedData = secret(parsed.body.encryptedData, 65536)
  const dataIv        = secret(parsed.body.dataIv, 256)
  const contentHash   = secret(parsed.body.contentHash, 256)

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      clinicId: dentist.clinicId,
      isDeleted: false,
      appointments: {
        some: { dentistId: dentist.dentistId, isDeleted: false, status: { in: ['CONFIRMED', 'COMPLETED'] } }
      }
    }
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  // Envelope encryption: when notes are present, the client sends one CEK wrap per
  // authorized reader. The server re-derives the authoritative recipient set and
  // requires exact coverage (never trusting the client's list).
  let wrapRows = []
  if (encryptedData) {
    const result = await getRecordRecipients({ patientId, clinicId: dentist.clinicId })
    if (!result) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    const recipientIds = new Set(result.recipients.map((r) => r.userId))
    const validation = validateWraps({ keys: parsed.body.keys, recipientIds })
    if (!validation.ok) return NextResponse.json({ error: `Record key wrapping failed: ${validation.error}` }, { status: 400 })
    wrapRows = validation.rows
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.patientRecord.create({
      data: {
        patientId,
        clinicId: dentist.clinicId,
        title,
        encryptedData: encryptedData || null,
        dataIv: dataIv || null,
        contentHash: contentHash || null,
      },
      select: { id: true, title: true, encryptedData: true, dataIv: true, contentHash: true, status: true, createdAt: true, updatedAt: true }
    })
    if (wrapRows.length > 0) {
      await tx.recordKey.createMany({
        data: wrapRows.map((w) => ({ recordId: created.id, userId: w.userId, wrappedKey: w.wrappedKey })),
      })
    }
    return created
  })

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId: dentist.clinicId, action: 'CREATE', entity: 'PatientRecord', entityId: record.id, ipAddress: ip, userAgent })
  return NextResponse.json(record, { status: 201 })
}
