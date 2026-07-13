import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin, ROLES } from '@/lib/roles'
import { parseJsonBody, str } from '@/lib/validate'
import { generatePatientCode } from '@/lib/patients'
import { createNotification } from '@/lib/notifications'
import { getRequestMeta, logAudit } from '@/lib/audit'

export async function GET(_request, { params }) {
  const session = await getSession()
  const caller = await getAuthContext()
  if (!session || !caller || !isAdmin(caller.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  const { id } = await params
  const transfer = await prisma.recordTransfer.findFirst({ where: { id, destinationClinicId: clinicId }, select: { id: true } })
  if (!transfer) return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 })
  const dentists = await prisma.dentist.findMany({ where: { clinicId, isDeleted: false, user: { isDeleted: false, isActive: true, publicKey: { not: null } } }, select: { id: true, user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ dentists })
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  const caller = await getAuthContext()
  if (!session || !caller || !isAdmin(caller.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  const { id } = await params
  const transfer = await prisma.recordTransfer.findFirst({
    where: { id, destinationClinicId: clinicId },
    include: { sourcePatient: true, dataRequest: { select: { userId: true } }, sourceClinic: { select: { name: true } } },
  })
  if (!transfer) return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 })
  if (transfer.status !== 'PENDING_DESTINATION_ACCEPTANCE') return NextResponse.json({ error: 'This incoming request is not awaiting review' }, { status: 409 })
  if (transfer.expiresAt && transfer.expiresAt <= new Date()) return NextResponse.json({ error: 'This request has expired' }, { status: 410 })
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const action = str(parsed.body.action, 20)?.toUpperCase()
  const notes = str(parsed.body.notes, 2000)
  const dentistId = str(parsed.body.dentistId, 80)
  if (!['ACCEPT', 'REJECT'].includes(action)) return NextResponse.json({ error: 'Action must be ACCEPT or REJECT' }, { status: 400 })
  if (action === 'REJECT' && !notes) return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 })
  let dentist = null
  if (action === 'ACCEPT') {
    dentist = await prisma.dentist.findFirst({ where: { id: dentistId, clinicId, isDeleted: false, user: { isDeleted: false, isActive: true, publicKey: { not: null } } }, select: { id: true } })
    if (!dentist) return NextResponse.json({ error: 'Select an eligible receiving dentist' }, { status: 400 })
  }

  const now = new Date()
  let destinationPatientId = null
  await prisma.$transaction(async (tx) => {
    if (action === 'ACCEPT') {
      let enrollment = await tx.patient.findUnique({ where: { userId_clinicId: { userId: transfer.dataRequest.userId, clinicId } }, select: { id: true, isDeleted: true } })
      if (!enrollment) {
        const patientCode = await generatePatientCode(clinicId, tx)
        enrollment = await tx.patient.create({ data: { userId: transfer.dataRequest.userId, clinicId, patientCode, firstName: transfer.sourcePatient.firstName, lastName: transfer.sourcePatient.lastName, phone: transfer.sourcePatient.phone, address: transfer.sourcePatient.address, dateOfBirth: transfer.sourcePatient.dateOfBirth, gender: transfer.sourcePatient.gender, consentStatus: 'GIVEN', consentGivenAt: now }, select: { id: true } })
      } else if (enrollment.isDeleted) {
        enrollment = await tx.patient.update({ where: { id: enrollment.id }, data: { isDeleted: false, deletedAt: null, consentStatus: 'GIVEN', consentGivenAt: now }, select: { id: true } })
      }
      destinationPatientId = enrollment.id
      await tx.patientCareAssignment.upsert({ where: { patientId_dentistId: { patientId: enrollment.id, dentistId: dentist.id } }, create: { clinicId, patientId: enrollment.id, dentistId: dentist.id, transferId: transfer.id }, update: { isActive: true, transferId: transfer.id } })
    }
    const claimed = await tx.recordTransfer.updateMany({ where: { id, status: 'PENDING_DESTINATION_ACCEPTANCE' }, data: { status: action === 'ACCEPT' ? 'READY' : 'DESTINATION_REJECTED', destinationPatientId, destinationDentistId: dentist?.id ?? null, destinationDecisionById: session.userId, destinationDecisionAt: now, destinationDecisionNotes: notes || null, expiresAt: action === 'ACCEPT' ? new Date(now.getTime() + 30 * 86400000) : transfer.expiresAt } })
    if (claimed.count !== 1) throw new Error('REQUEST_ALREADY_REVIEWED')
    if (action === 'REJECT') await tx.dataRequest.update({ where: { id: transfer.dataRequestId }, data: { status: 'REJECTED', resolvedAt: now, adminNotes: notes } })
  })

  await createNotification({ userId: transfer.dataRequest.userId, clinicId: transfer.sourceClinicId, type: action === 'ACCEPT' ? 'TRANSFER_ACCEPTED' : 'TRANSFER_REJECTED', title: action === 'ACCEPT' ? 'Destination clinic accepted your transfer' : 'Destination clinic declined your transfer', body: action === 'ACCEPT' ? 'Your records are ready to be securely transferred.' : notes }).catch(() => {})
  if (action === 'ACCEPT' && transfer.sourceDentistId) {
    const sourceDentist = await prisma.dentist.findUnique({ where: { id: transfer.sourceDentistId }, select: { userId: true } })
    if (sourceDentist) await createNotification({ userId: sourceDentist.userId, clinicId: transfer.sourceClinicId, type: 'TRANSFER_ACCEPTED', title: 'Approved transfer ready', body: `${transfer.sourcePatient.firstName} ${transfer.sourcePatient.lastName}'s approved transfer is ready to process.` }).catch(() => {})
  }
  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId, action: 'UPDATE', entity: 'RecordTransfer', entityId: id, ipAddress: ip, userAgent, metadata: { action, dentistId, notes, destinationPatientId } })
  return NextResponse.json({ ok: true, status: action === 'ACCEPT' ? 'READY' : 'DESTINATION_REJECTED' })
}
