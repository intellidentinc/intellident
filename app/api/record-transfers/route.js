import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { parseJsonBody, str } from '@/lib/validate'
import { checkRateLimit } from '@/lib/rateLimit'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { notifyStaff } from '@/lib/notifications'
import { getTransferDentist, transferInclude } from './helpers'

export async function GET(request) {
  const session = await getSession()
  const caller = await getAuthContext()
  if (!session || !caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'source'
  let where

  if (caller.role === ROLES.PATIENT) {
    where = { dataRequest: { userId: session.userId } }
  } else if (isAdmin(caller.role)) {
    const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
    where = view === 'incoming' ? { destinationClinicId: clinicId } : { sourceClinicId: clinicId }
  } else if (caller.role === ROLES.DENTIST) {
    const dentist = await getTransferDentist(session)
    if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    where = { sourceClinicId: dentist.clinicId, sourceDentistId: dentist.dentistId }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const transfers = await prisma.recordTransfer.findMany({ where, include: transferInclude, orderBy: { createdAt: 'desc' }, take: 100 })
  return NextResponse.json({ transfers })
}

export async function POST(request) {
  const session = await getSession()
  const caller = await getAuthContext()
  if (!session || !caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (caller.role !== ROLES.PATIENT) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { ip, userAgent } = getRequestMeta(request)
  const rl = await checkRateLimit(`${ip ?? 'unknown'}:record-transfer`, 5, 3600)
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const destinationClinicId = str(parsed.body.destinationClinicId, 80)
  const description = str(parsed.body.description, 2000)
  const recordIds = [...new Set(Array.isArray(parsed.body.recordIds) ? parsed.body.recordIds.map((id) => str(id, 80)).filter(Boolean) : [])]
  if (!destinationClinicId || recordIds.length === 0 || recordIds.length > 50) return NextResponse.json({ error: 'Choose a destination clinic and at least one record' }, { status: 400 })
  if (destinationClinicId === caller.clinicId) return NextResponse.json({ error: 'Choose a different destination clinic' }, { status: 400 })

  const [sourcePatient, destinationClinic] = await Promise.all([
    prisma.patient.findUnique({ where: { userId_clinicId: { userId: session.userId, clinicId: caller.clinicId } }, select: { id: true } }),
    prisma.clinic.findFirst({ where: { id: destinationClinicId, isDeleted: false, isEnabled: true }, select: { id: true, name: true } }),
  ])
  if (!sourcePatient) return NextResponse.json({ error: 'Source patient enrollment not found' }, { status: 404 })
  if (!destinationClinic) return NextResponse.json({ error: 'Destination clinic not found' }, { status: 404 })
  const records = await prisma.patientRecord.findMany({ where: { id: { in: recordIds }, patientId: sourcePatient.id, clinicId: caller.clinicId, isDeleted: false, status: 'ACTIVE' }, select: { id: true } })
  if (records.length !== recordIds.length) return NextResponse.json({ error: 'One or more selected records are unavailable' }, { status: 400 })

  const created = await prisma.$transaction(async (tx) => {
    const dataRequest = await tx.dataRequest.create({ data: { userId: session.userId, clinicId: caller.clinicId, type: 'TRANSFER', description: description || null } })
    return tx.recordTransfer.create({
      data: {
        dataRequestId: dataRequest.id, sourceClinicId: caller.clinicId, destinationClinicId,
        sourcePatientId: sourcePatient.id, items: { create: recordIds.map((sourceRecordId) => ({ sourceRecordId })) },
      },
      include: transferInclude,
    })
  })
  await notifyStaff({ clinicId: caller.clinicId, type: 'TRANSFER_REQUESTED', title: 'Record transfer requested', body: `A patient requested ${recordIds.length} record${recordIds.length === 1 ? '' : 's'} be transferred to ${destinationClinic.name}.` }).catch(() => {})
  logAudit({ userId: session.userId, clinicId: caller.clinicId, action: 'CREATE', entity: 'RecordTransfer', entityId: created.id, ipAddress: ip, userAgent, metadata: { destinationClinicId, recordIds } })
  return NextResponse.json({ transfer: created }, { status: 201 })
}
