import { NextResponse } from 'next/server'
import { isStepUpValid } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActivePatientContext } from '@/lib/patient-context'
import { logAudit, getRequestMeta } from '@/lib/audit'

export async function GET(request, { params }) {
  const caller = await getActivePatientContext()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!isStepUpValid(caller.session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const { recordId } = await params

  const record = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId: caller.patientId, clinicId: caller.clinicId, isDeleted: false },
    select: {
      id: true,
      title: true,
      encryptedData: true,
      dataIv: true,
      contentHash: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  // Envelope: hand the patient their own CEK wrap so the client can unwrap + decrypt.
  const myWrap = await prisma.recordKey.findUnique({
    where: { recordId_userId: { recordId, userId: caller.userId } },
    select: { wrappedKey: true },
  })

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: caller.userId, clinicId: caller.clinicId, action: 'VIEW', entity: 'PatientRecord', entityId: recordId, ipAddress: ip, userAgent })
  return NextResponse.json({
    record: { ...record, patientId: caller.patientId, wrappedKey: myWrap?.wrappedKey ?? null, needsReshare: !!record.encryptedData && !myWrap },
  })
}
