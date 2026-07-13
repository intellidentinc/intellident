import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin, ROLES } from '@/lib/roles'
import { parseJsonBody, str } from '@/lib/validate'
import { notifyStaff, createNotification } from '@/lib/notifications'
import { getRequestMeta, logAudit } from '@/lib/audit'

async function getContext(params) {
  const session = await getSession()
  const caller = await getAuthContext()
  if (!session || !caller || !isAdmin(caller.role)) return { error: 'Forbidden', status: 403 }
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  const { id } = await params
  const transfer = await prisma.recordTransfer.findFirst({
    where: { id, sourceClinicId: clinicId },
    include: { items: { select: { sourceRecordId: true } }, destinationClinic: { select: { name: true } }, sourcePatient: { select: { id: true, userId: true, firstName: true, lastName: true } } },
  })
  if (!transfer) return { error: 'Transfer request not found', status: 404 }
  return { session, caller, clinicId, transfer }
}

async function eligibleDentists(transfer) {
  const candidates = await prisma.dentist.findMany({
    where: {
      clinicId: transfer.sourceClinicId, isDeleted: false,
      user: { isDeleted: false, isActive: true, publicKey: { not: null } },
      OR: [
        { appointments: { some: { patientId: transfer.sourcePatientId, isDeleted: false, status: { in: ['CONFIRMED', 'COMPLETED'] } } } },
        { careAssignments: { some: { patientId: transfer.sourcePatientId, isActive: true } } },
      ],
    },
    select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
  })
  const encryptedRecords = await prisma.patientRecord.findMany({ where: { id: { in: transfer.items.map((item) => item.sourceRecordId) }, encryptedData: { not: null } }, select: { id: true } })
  const recordIds = encryptedRecords.map((record) => record.id)
  if (!recordIds.length) return candidates
  const rows = await prisma.recordKey.groupBy({ by: ['userId'], where: { recordId: { in: recordIds }, userId: { in: candidates.map((d) => d.userId) } }, _count: { recordId: true } })
  const covered = new Set(rows.filter((row) => row._count.recordId === recordIds.length).map((row) => row.userId))
  return candidates.filter((dentist) => covered.has(dentist.userId))
}

export async function GET(_request, { params }) {
  const ctx = await getContext(params)
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  return NextResponse.json({ dentists: await eligibleDentists(ctx.transfer) })
}

export async function PATCH(request, { params }) {
  const ctx = await getContext(params)
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const action = str(parsed.body.action, 20)?.toUpperCase()
  const notes = str(parsed.body.notes, 2000)
  const dentistId = str(parsed.body.dentistId, 80)
  if (!['APPROVE', 'DENY'].includes(action)) return NextResponse.json({ error: 'Action must be APPROVE or DENY' }, { status: 400 })
  if (ctx.transfer.status !== 'PENDING_SOURCE_REVIEW') return NextResponse.json({ error: 'This request has already been reviewed' }, { status: 409 })

  let selectedDentist = null
  if (action === 'APPROVE') {
    if (!dentistId) return NextResponse.json({ error: 'Assign an eligible dentist' }, { status: 400 })
    selectedDentist = (await eligibleDentists(ctx.transfer)).find((d) => d.id === dentistId)
    if (!selectedDentist) return NextResponse.json({ error: 'The selected dentist cannot decrypt every approved record' }, { status: 400 })
  } else if (!notes) {
    return NextResponse.json({ error: 'A denial reason is required' }, { status: 400 })
  }

  const now = new Date()
  const status = action === 'APPROVE' ? 'PENDING_DESTINATION_ACCEPTANCE' : 'SOURCE_REJECTED'
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.recordTransfer.updateMany({
        where: { id: ctx.transfer.id, status: 'PENDING_SOURCE_REVIEW' },
        data: { status, sourceDentistId: selectedDentist?.id ?? null, sourceDecisionById: ctx.session.userId, sourceDecisionAt: now, sourceDecisionNotes: notes || null, expiresAt: action === 'APPROVE' ? new Date(now.getTime() + 30 * 86400000) : null },
      })
      if (claimed.count !== 1) throw new Error('REQUEST_ALREADY_REVIEWED')
      await tx.dataRequest.update({ where: { id: ctx.transfer.dataRequestId }, data: { status: action === 'APPROVE' ? 'IN_REVIEW' : 'REJECTED', adminNotes: notes || null, resolvedAt: action === 'DENY' ? now : null } })
    })
  } catch (error) {
    if (error.message === 'REQUEST_ALREADY_REVIEWED') return NextResponse.json({ error: 'This request has already been reviewed' }, { status: 409 })
    throw error
  }

  if (action === 'APPROVE') {
    await notifyStaff({ clinicId: ctx.transfer.destinationClinicId, type: 'TRANSFER_APPROVED', title: 'Incoming record transfer', body: `${ctx.transfer.sourcePatient.firstName} ${ctx.transfer.sourcePatient.lastName} requested enrollment and a record transfer from another clinic.` }).catch(() => {})
  }
  await createNotification({ userId: ctx.transfer.sourcePatient.userId, clinicId: ctx.transfer.sourceClinicId, type: action === 'APPROVE' ? 'TRANSFER_APPROVED' : 'TRANSFER_REJECTED', title: action === 'APPROVE' ? 'Transfer approved by source clinic' : 'Transfer request denied', body: action === 'APPROVE' ? `Your request is awaiting acceptance from ${ctx.transfer.destinationClinic.name}.` : notes }).catch(() => {})
  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: ctx.session.userId, clinicId: ctx.clinicId, action: 'UPDATE', entity: 'RecordTransfer', entityId: ctx.transfer.id, ipAddress: ip, userAgent, metadata: { action, dentistId, notes } })
  return NextResponse.json({ ok: true, status })
}
