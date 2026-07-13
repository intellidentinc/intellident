import { NextResponse } from 'next/server'
import { getSession, isStepUpValid } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseJsonBody, str } from '@/lib/validate'
import { getTransferDentist, getDestinationRecipients, isExpired } from '../helpers'

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
    include: {
      destinationClinic: { select: { id: true, name: true } },
      destinationPatient: { select: { id: true, userId: true, patientCode: true, firstName: true, lastName: true } },
      items: { include: { sourceRecord: { select: { id: true, title: true, encryptedData: true, dataIv: true, contentHash: true, isDeleted: true } } } },
    },
  })
  if (!transfer) return NextResponse.json({ error: 'Approved transfer not found' }, { status: 404 })
  if (isExpired(transfer)) return NextResponse.json({ error: 'This transfer approval has expired' }, { status: 410 })
  if (!['READY', 'FAILED'].includes(transfer.status)) return NextResponse.json({ error: 'This transfer is not ready' }, { status: 409 })
  if (!transfer.destinationPatient) return NextResponse.json({ error: 'Destination enrollment is not ready' }, { status: 409 })
  if (transfer.items.some((item) => item.sourceRecord.isDeleted)) return NextResponse.json({ error: 'An approved source record is no longer available' }, { status: 409 })
  const recipientsResult = await getDestinationRecipients(transfer)
  if (!recipientsResult?.recipients.length || !recipientsResult.recipients.some((recipient) => recipient.userId === transfer.destinationPatient.userId)) {
    return NextResponse.json({ error: 'Destination patient encryption key is not ready' }, { status: 409 })
  }
  const encryptedRecordIds = transfer.items.filter((item) => item.sourceRecord.encryptedData).map((item) => item.sourceRecordId)
  const wraps = await prisma.recordKey.findMany({ where: { recordId: { in: encryptedRecordIds }, userId: session.userId }, select: { recordId: true, wrappedKey: true } })
  const byRecord = new Map(wraps.map((wrap) => [wrap.recordId, wrap.wrappedKey]))
  if (byRecord.size !== encryptedRecordIds.length) return NextResponse.json({ error: 'Your encryption key does not cover every approved record' }, { status: 409 })

  return NextResponse.json({
    transfer: { id: transfer.id, sourcePatientId: transfer.sourcePatientId, destinationClinic: transfer.destinationClinic, destinationPatient: transfer.destinationPatient },
    records: transfer.items.map((item) => ({ ...item.sourceRecord, wrappedKey: byRecord.get(item.sourceRecordId) })),
    recipients: recipientsResult.recipients,
  })
}
