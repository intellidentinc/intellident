import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { ROLES } from '@/lib/roles'
import { getRecordsDentist, getRecordRecipients } from '@/lib/records-access'

export const ACTIVE_TRANSFER_STATUSES = [
  'PENDING_SOURCE_REVIEW', 'PENDING_DESTINATION_ACCEPTANCE', 'READY', 'PROCESSING', 'FAILED',
]

export async function getTransferDentist(session) {
  const caller = await getAuthContext()
  if (!caller || caller.role !== ROLES.DENTIST) return null
  const dentist = await getRecordsDentist(session)
  if (!dentist || dentist.clinicId !== caller.clinicId) return null
  return dentist
}

export async function getDestinationRecipients(transfer) {
  if (!transfer.destinationPatientId) return null
  return getRecordRecipients({ patientId: transfer.destinationPatientId, clinicId: transfer.destinationClinicId })
}

export function isExpired(transfer) {
  return transfer.expiresAt && new Date(transfer.expiresAt) <= new Date()
}

export async function markExpiredIfNeeded(transfer) {
  if (!isExpired(transfer) || ['COMPLETED', 'SOURCE_REJECTED', 'DESTINATION_REJECTED', 'EXPIRED'].includes(transfer.status)) return transfer
  return prisma.$transaction(async (tx) => {
    const updated = await tx.recordTransfer.update({ where: { id: transfer.id }, data: { status: 'EXPIRED' } })
    await tx.dataRequest.update({ where: { id: transfer.dataRequestId }, data: { status: 'REJECTED', resolvedAt: new Date(), adminNotes: 'Transfer request expired.' } })
    return updated
  })
}

export const transferInclude = {
  sourceClinic: { select: { id: true, name: true, code: true } },
  destinationClinic: { select: { id: true, name: true, code: true } },
  sourcePatient: { select: { id: true, userId: true, patientCode: true, firstName: true, lastName: true, phone: true, dateOfBirth: true, address: true } },
  destinationPatient: { select: { id: true, patientCode: true } },
  dataRequest: { select: { id: true, userId: true, status: true, description: true, adminNotes: true, createdAt: true, updatedAt: true } },
  items: {
    select: {
      id: true, sourceRecordId: true, destinationRecordId: true,
      sourceRecord: { select: { title: true, status: true, createdAt: true, updatedAt: true, isDeleted: true, _count: { select: { attachments: { where: { isDeleted: false } } } } } },
    },
    orderBy: { createdAt: 'asc' },
  },
}
