import { NextResponse } from 'next/server'
import { getSession, isStepUpValid } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseJsonBody, str, secret } from '@/lib/validate'
import { supabase } from '@/lib/supabase'
import { logAudit, getRequestMeta } from '@/lib/audit'
import { getRecordsDentist, dentistTreatsPatient, getRecordRecipients, validateWraps } from '@/lib/records-access'

const ATTACHMENT_BUCKET = 'record-attachments'

// GET /api/records/[patientId]/[recordId]
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isStepUpValid(session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const dentist = await getRecordsDentist(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, recordId } = await params

  if (!(await dentistTreatsPatient({ dentistId: dentist.dentistId, patientId, clinicId: dentist.clinicId }))) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  const record = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: dentist.clinicId, isDeleted: false },
    select: {
      id: true, title: true, encryptedData: true, dataIv: true, contentHash: true, status: true, createdAt: true, updatedAt: true,
      attachments: { where: { isDeleted: false }, select: { id: true, fileName: true, mimeType: true, fileUrl: true, createdAt: true }, orderBy: { createdAt: 'asc' } }
    }
  })
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  // Envelope: hand the caller their own CEK wrap (if any). No wrap → the caller joined
  // as a treating dentist after the record was written; the client flags needsReshare so
  // a current key-holder (the patient, or another dentist) can re-wrap on next view.
  const myWrap = await prisma.recordKey.findUnique({
    where: { recordId_userId: { recordId, userId: session.userId } },
    select: { wrappedKey: true },
  })

  // Generate 1-hour signed URLs for each attachment
  const attachments = await Promise.all(
    record.attachments.map(async (att) => {
      const { data } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(att.fileUrl, 3600)
      return { id: att.id, fileName: att.fileName, mimeType: att.mimeType, signedUrl: data?.signedUrl ?? null, createdAt: att.createdAt }
    })
  )

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId: dentist.clinicId, action: 'VIEW', entity: 'PatientRecord', entityId: recordId, ipAddress: ip, userAgent })
  return NextResponse.json({
    record: { ...record, patientId, attachments, wrappedKey: myWrap?.wrappedKey ?? null, needsReshare: !!record.encryptedData && !myWrap },
  })
}

// PATCH /api/records/[patientId]/[recordId]
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getRecordsDentist(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, recordId } = await params

  if (!(await dentistTreatsPatient({ dentistId: dentist.dentistId, patientId, clinicId: dentist.clinicId }))) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const title         = parsed.body.title !== undefined ? str(parsed.body.title, 200) : undefined
  const encryptedData = parsed.body.encryptedData !== undefined ? secret(parsed.body.encryptedData, 65536) : undefined
  const dataIv        = parsed.body.dataIv !== undefined ? secret(parsed.body.dataIv, 256) : undefined
  const contentHash   = parsed.body.contentHash !== undefined ? secret(parsed.body.contentHash, 256) : undefined
  const { status }    = parsed.body

  if (parsed.body.title !== undefined && !title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const existing = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: dentist.clinicId, isDeleted: false },
    select: { id: true, title: true, status: true },
  })
  if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  // Notes changed → a fresh CEK was used → the client re-supplies wraps for all
  // authorized readers. Validate exact coverage and replace the record's key wraps.
  const reKeying = parsed.body.notesChanged === true && encryptedData !== undefined
  let wrapRows = null
  if (reKeying && encryptedData) {
    const result = await getRecordRecipients({ patientId, clinicId: dentist.clinicId })
    if (!result) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    const recipientIds = new Set(result.recipients.map((r) => r.userId))
    const validation = validateWraps({ keys: parsed.body.keys, recipientIds })
    if (!validation.ok) return NextResponse.json({ error: `Record key wrapping failed: ${validation.error}` }, { status: 400 })
    wrapRows = validation.rows
  }

  const validStatuses = ['ACTIVE', 'ARCHIVED']
  const record = await prisma.$transaction(async (tx) => {
    const updated = await tx.patientRecord.update({
      where: { id: recordId },
      data: {
        ...(title !== undefined && { title }),
        ...(encryptedData !== undefined && { encryptedData: encryptedData || null }),
        ...(dataIv !== undefined && { dataIv: dataIv || null }),
        ...(contentHash !== undefined && { contentHash: contentHash || null }),
        ...(status !== undefined && validStatuses.includes(status) && { status }),
      },
      select: { id: true, title: true, encryptedData: true, dataIv: true, contentHash: true, status: true, createdAt: true, updatedAt: true }
    })
    if (wrapRows) {
      await tx.recordKey.deleteMany({ where: { recordId } })
      await tx.recordKey.createMany({ data: wrapRows.map((w) => ({ recordId, userId: w.userId, wrappedKey: w.wrappedKey })) })
    }
    return updated
  })

  // Build and store field-level diff (fire-and-forget)
  const diff = {}
  if (title !== undefined && title !== existing.title) diff.title = { old: existing.title, new: title }
  if (status !== undefined && validStatuses.includes(status) && status !== existing.status) diff.status = { old: existing.status, new: status }
  if (parsed.body.notesChanged === true) diff.notesChanged = true
  if (Object.keys(diff).length > 0) {
    prisma.recordHistory.create({
      data: { recordId, userId: session.userId, diff },
    }).catch(() => {})
  }

  const { ip: patchIp, userAgent: patchUa } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId: dentist.clinicId, action: 'UPDATE', entity: 'PatientRecord', entityId: recordId, ipAddress: patchIp, userAgent: patchUa })
  return NextResponse.json(record)
}

// DELETE /api/records/[patientId]/[recordId]
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getRecordsDentist(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, recordId } = await params

  if (!(await dentistTreatsPatient({ dentistId: dentist.dentistId, patientId, clinicId: dentist.clinicId }))) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  const existing = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: dentist.clinicId, isDeleted: false }
  })
  if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  await prisma.patientRecord.update({
    where: { id: recordId },
    data: { isDeleted: true, deletedAt: new Date() }
  })

  const { ip: delIp, userAgent: delUa } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId: dentist.clinicId, action: 'DELETE', entity: 'PatientRecord', entityId: recordId, ipAddress: delIp, userAgent: delUa })
  return NextResponse.json({ success: true })
}
