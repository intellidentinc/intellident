import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { logAudit, getRequestMeta } from '@/lib/audit'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getAuthContext()

  if (!user || user.role !== ROLES.PATIENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = await prisma.patient.findFirst({
    where: { userId: session.userId, clinicId: user.clinicId, isDeleted: false },
    select: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient record not found' }, { status: 404 })

  const { recordId } = await params

  const record = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId: patient.id, clinicId: user.clinicId, isDeleted: false },
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
    where: { recordId_userId: { recordId, userId: session.userId } },
    select: { wrappedKey: true },
  })

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId: user.clinicId, action: 'VIEW', entity: 'PatientRecord', entityId: recordId, ipAddress: ip, userAgent })
  return NextResponse.json({
    record: { ...record, patientId: patient.id, wrappedKey: myWrap?.wrappedKey ?? null, needsReshare: !!record.encryptedData && !myWrap },
  })
}
