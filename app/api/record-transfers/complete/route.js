import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession, isStepUpValid } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'
import { parseJsonBody, str, secret } from '@/lib/validate'
import { validateWraps } from '@/lib/records-access'
import { getTransferDentist, getDestinationRecipients, isExpired } from '../helpers'
import { createNotification } from '@/lib/notifications'
import { getRequestMeta, logAudit } from '@/lib/audit'

const BUCKET = 'record-attachments'

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isStepUpValid(session)) return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  const dentist = await getTransferDentist(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const transferId = str(parsed.body.transferId, 80)
  const transfer = await prisma.recordTransfer.findFirst({
    where: { id: transferId, sourceClinicId: dentist.clinicId, sourceDentistId: dentist.dentistId },
    include: { items: { include: { sourceRecord: { include: { attachments: { where: { isDeleted: false } } } } } }, destinationPatient: { select: { id: true, userId: true } } },
  })
  if (!transfer) return NextResponse.json({ error: 'Approved transfer not found' }, { status: 404 })
  if (transfer.status === 'COMPLETED') return NextResponse.json({ ok: true, alreadyCompleted: true })
  if (isExpired(transfer)) return NextResponse.json({ error: 'This transfer approval has expired' }, { status: 410 })
  if (!['READY', 'FAILED'].includes(transfer.status) || !transfer.destinationPatient) return NextResponse.json({ error: 'This transfer is not ready' }, { status: 409 })

  const supplied = Array.isArray(parsed.body.records) ? parsed.body.records : []
  const approvedIds = new Set(transfer.items.map((item) => item.sourceRecordId))
  if (supplied.length !== approvedIds.size) return NextResponse.json({ error: 'Every approved record must be supplied exactly once' }, { status: 400 })
  const recipientsResult = await getDestinationRecipients(transfer)
  const recipientIds = new Set(recipientsResult?.recipients.map((recipient) => recipient.userId) ?? [])
  if (!recipientIds.has(transfer.destinationPatient.userId)) return NextResponse.json({ error: 'Destination patient encryption key is not ready' }, { status: 409 })
  const payloadById = new Map()
  for (const raw of supplied) {
    const sourceRecordId = str(raw?.sourceRecordId, 80)
    const title = str(raw?.title, 200)
    const encryptedData = secret(raw?.encryptedData, 65536)
    const dataIv = secret(raw?.dataIv, 256)
    const contentHash = secret(raw?.contentHash, 256)
    if (!approvedIds.has(sourceRecordId) || payloadById.has(sourceRecordId) || !title || !encryptedData || !dataIv || !contentHash) return NextResponse.json({ error: 'Invalid transferred record payload' }, { status: 400 })
    const validation = validateWraps({ keys: raw.keys, recipientIds })
    if (!validation.ok) return NextResponse.json({ error: `Record key wrapping failed: ${validation.error}` }, { status: 400 })
    payloadById.set(sourceRecordId, { title, encryptedData, dataIv, contentHash, keys: validation.rows })
  }

  const claim = await prisma.recordTransfer.updateMany({ where: { id: transfer.id, status: { in: ['READY', 'FAILED'] } }, data: { status: 'PROCESSING', processingStartedAt: new Date(), failureReason: null } })
  if (claim.count !== 1) return NextResponse.json({ error: 'This transfer is already being processed' }, { status: 409 })

  const copiedPaths = []
  try {
    const attachmentCopies = new Map()
    for (const item of transfer.items) {
      const copies = []
      for (const attachment of item.sourceRecord.attachments) {
        const ext = attachment.fileUrl.split('.').pop()?.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
        const destinationPath = `${transfer.destinationClinicId}/${transfer.destinationPatient.id}/transfer-${transfer.id}/${Date.now()}-${randomBytes(12).toString('hex')}.${ext}`
        const { error } = await supabase.storage.from(BUCKET).copy(attachment.fileUrl, destinationPath)
        if (error) throw new Error(`Could not copy attachment ${attachment.fileName}`)
        copiedPaths.push(destinationPath)
        copies.push({ fileName: attachment.fileName, fileUrl: destinationPath, mimeType: attachment.mimeType })
      }
      attachmentCopies.set(item.sourceRecordId, copies)
    }

    const completedAt = new Date()
    const created = await prisma.$transaction(async (tx) => {
      const destinationRecords = []
      for (const item of transfer.items) {
        const payload = payloadById.get(item.sourceRecordId)
        const record = await tx.patientRecord.create({
          data: {
            patientId: transfer.destinationPatient.id, clinicId: transfer.destinationClinicId,
            title: payload.title, encryptedData: payload.encryptedData, dataIv: payload.dataIv, contentHash: payload.contentHash,
            recordKeys: { create: payload.keys.map((key) => ({ userId: key.userId, wrappedKey: key.wrappedKey })) },
            attachments: { create: attachmentCopies.get(item.sourceRecordId) },
          },
          select: { id: true, title: true },
        })
        await tx.recordTransferItem.update({ where: { id: item.id }, data: { destinationRecordId: record.id } })
        destinationRecords.push(record)
      }
      await tx.recordTransfer.update({ where: { id: transfer.id }, data: { status: 'COMPLETED', completedAt, failureReason: null } })
      await tx.dataRequest.update({ where: { id: transfer.dataRequestId }, data: { status: 'RESOLVED', resolvedAt: completedAt } })
      return destinationRecords
    })
    await createNotification({ userId: transfer.destinationPatient.userId, clinicId: transfer.destinationClinicId, type: 'TRANSFER_COMPLETED', title: 'Record transfer completed', body: `${created.length} dental record${created.length === 1 ? '' : 's'} are now available at your destination clinic.` }).catch(() => {})
    const { ip, userAgent } = getRequestMeta(request)
    logAudit({ userId: session.userId, clinicId: transfer.sourceClinicId, action: 'EXPORT', entity: 'RecordTransfer', entityId: transfer.id, ipAddress: ip, userAgent, metadata: { destinationClinicId: transfer.destinationClinicId, destinationRecordIds: created.map((record) => record.id) } })
    return NextResponse.json({ ok: true, records: created }, { status: 201 })
  } catch (error) {
    if (copiedPaths.length) await supabase.storage.from(BUCKET).remove(copiedPaths).catch(() => {})
    await prisma.recordTransfer.updateMany({ where: { id: transfer.id, status: 'PROCESSING' }, data: { status: 'FAILED', failureReason: String(error.message || 'Transfer failed').slice(0, 500) } })
    return NextResponse.json({ error: error.message || 'Transfer failed' }, { status: 500 })
  }
}
