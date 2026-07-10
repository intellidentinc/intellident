import { NextResponse } from 'next/server'
import { getSession, isStepUpValid } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, secret, str } from '@/lib/validate'
import { validateWraps } from '@/lib/records-access'
import { getSourceRecord, getTransferDentist, resolveTransferTarget } from './helpers'

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isStepUpValid(session)) return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })

  const dentist = await getTransferDentist(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const sourcePatientId = str(parsed.body.sourcePatientId, 80)
  const sourceRecordId = str(parsed.body.sourceRecordId, 80)
  const targetClinicId = str(parsed.body.targetClinicId, 80)
  const targetPatientIdentifier = str(parsed.body.targetPatientIdentifier, 254)
  const title = str(parsed.body.title, 200)
  const encryptedData = secret(parsed.body.encryptedData, 65536)
  const dataIv = secret(parsed.body.dataIv, 256)
  const contentHash = secret(parsed.body.contentHash, 256)
  const patientConsentConfirmed = parsed.body.patientConsentConfirmed === true
  const sourceClinicApprovalConfirmed = parsed.body.sourceClinicApprovalConfirmed === true

  if (!sourcePatientId || !sourceRecordId || !targetClinicId || !targetPatientIdentifier || !title) {
    return NextResponse.json({ error: 'Missing transfer details' }, { status: 400 })
  }
  if (!patientConsentConfirmed || !sourceClinicApprovalConfirmed) {
    return NextResponse.json({ error: 'Patient consent and source clinic approval are required' }, { status: 400 })
  }
  if (!encryptedData || !dataIv || !contentHash) {
    return NextResponse.json({ error: 'Encrypted transferred record payload is required' }, { status: 400 })
  }

  const sourceRecord = await getSourceRecord({ dentist, sourcePatientId, sourceRecordId })
  if (!sourceRecord) return NextResponse.json({ error: 'Source record not found' }, { status: 404 })

  const target = await resolveTransferTarget({
    sourceClinicId: dentist.clinicId,
    targetClinicId,
    targetPatientIdentifier,
  })
  if (target.error) return NextResponse.json({ error: target.error }, { status: target.status })

  const recipientIds = new Set(target.recipients.map((r) => r.userId))
  const validation = validateWraps({ keys: parsed.body.keys, recipientIds })
  if (!validation.ok) return NextResponse.json({ error: `Record key wrapping failed: ${validation.error}` }, { status: 400 })

  const copied = await prisma.$transaction(async (tx) => {
    const created = await tx.patientRecord.create({
      data: {
        patientId: target.targetPatient.id,
        clinicId: target.targetClinic.id,
        title,
        encryptedData,
        dataIv,
        contentHash,
        status: 'ACTIVE',
      },
      select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
    })

    await tx.recordKey.createMany({
      data: validation.rows.map((w) => ({ recordId: created.id, userId: w.userId, wrappedKey: w.wrappedKey })),
    })

    return created
  })

  logAudit({
    userId: session.userId,
    clinicId: dentist.clinicId,
    action: 'EXPORT',
    entity: 'PatientRecord',
    entityId: sourceRecord.id,
    ipAddress: ip,
    userAgent,
    metadata: {
      transferCopy: true,
      targetClinicId: target.targetClinic.id,
      targetPatientId: target.targetPatient.id,
      copiedRecordId: copied.id,
      patientConsentConfirmed,
      sourceClinicApprovalConfirmed,
    },
  })

  logAudit({
    userId: session.userId,
    clinicId: target.targetClinic.id,
    action: 'CREATE',
    entity: 'PatientRecord',
    entityId: copied.id,
    ipAddress: ip,
    userAgent,
    metadata: {
      transferCopy: true,
      sourceClinicId: dentist.clinicId,
      sourcePatientId,
      sourceRecordId,
      targetPatientId: target.targetPatient.id,
      copiedByUserId: session.userId,
      patientConsentConfirmed,
      sourceClinicApprovalConfirmed,
    },
  })

  return NextResponse.json({ record: copied, targetClinic: target.targetClinic, targetPatient: target.targetPatient }, { status: 201 })
}
