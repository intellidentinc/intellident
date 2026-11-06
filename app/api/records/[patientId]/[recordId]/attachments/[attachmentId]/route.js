import { NextResponse } from 'next/server'
import { getSession, isStepUpValid } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { removeStorageObjects } from '@/lib/storage'
import { getRecordsDentist, dentistTreatsPatient } from '@/lib/records-access'

const BUCKET = 'record-attachments'

// DELETE /api/records/[patientId]/[recordId]/attachments/[attachmentId]
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isStepUpValid(session, 'otp')) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const dentist = await getRecordsDentist(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, recordId, attachmentId } = await params

  if (!(await dentistTreatsPatient({ dentistId: dentist.dentistId, patientId, clinicId: dentist.clinicId }))) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  // Verify record belongs to this clinic and dentist's patient
  const record = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: dentist.clinicId, isDeleted: false }
  })
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, recordId, isDeleted: false }
  })
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

  try {
    await removeStorageObjects(BUCKET, [attachment.fileUrl])
  } catch {
    return NextResponse.json({ error: 'File deletion failed. Please retry.' }, { status: 502 })
  }

  await prisma.attachment.update({
    where: { id: attachmentId },
    data: { isDeleted: true, deletedAt: new Date() }
  })

  return NextResponse.json({ success: true })
}
