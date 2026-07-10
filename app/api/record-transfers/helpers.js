import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { ROLES } from '@/lib/roles'
import { sanitizeEmail, str } from '@/lib/validate'
import { getRecordsDentist, dentistTreatsPatient, getRecordRecipients } from '@/lib/records-access'

export async function getTransferDentist(session) {
  const caller = await getAuthContext()
  if (!caller || caller.role !== ROLES.DENTIST) return null

  const dentist = await getRecordsDentist(session)
  if (!dentist || dentist.clinicId !== caller.clinicId) return null

  return dentist
}

export async function getSourceRecord({ dentist, sourcePatientId, sourceRecordId }) {
  if (!(await dentistTreatsPatient({ dentistId: dentist.dentistId, patientId: sourcePatientId, clinicId: dentist.clinicId }))) {
    return null
  }

  return prisma.patientRecord.findFirst({
    where: { id: sourceRecordId, patientId: sourcePatientId, clinicId: dentist.clinicId, isDeleted: false },
    select: { id: true, title: true, status: true, patientId: true, clinicId: true },
  })
}

function normalizeTargetIdentifier(value) {
  const email = sanitizeEmail(value)
  if (email) return { email, patientCode: null }

  const patientCode = str(value, 80)
  if (patientCode) return { email: null, patientCode }

  return { email: null, patientCode: null }
}

export async function resolveTransferTarget({ sourceClinicId, targetClinicId, targetPatientIdentifier }) {
  if (!targetClinicId || targetClinicId === sourceClinicId) {
    return { error: 'Choose a different destination clinic', status: 400 }
  }

  const targetClinic = await prisma.clinic.findFirst({
    where: { id: targetClinicId, isDeleted: false, isEnabled: true },
    select: { id: true, name: true, code: true },
  })
  if (!targetClinic) return { error: 'Destination clinic not found', status: 404 }

  const { email, patientCode } = normalizeTargetIdentifier(targetPatientIdentifier)
  if (!email && !patientCode) {
    return { error: 'Enter the destination patient email or patient code', status: 400 }
  }

  let targetPatient = null

  if (email) {
    const targetUser = await prisma.user.findFirst({
      where: { email, clinicId: targetClinicId, role: ROLES.PATIENT, isDeleted: false, isActive: true },
      select: {
        email: true,
        publicKey: true,
        patient: { select: { id: true, userId: true, patientCode: true, firstName: true, lastName: true } },
      },
    })
    if (targetUser?.patient) targetPatient = { ...targetUser.patient, user: { email: targetUser.email, publicKey: targetUser.publicKey } }
  }

  if (!targetPatient && patientCode) {
    targetPatient = await prisma.patient.findFirst({
      where: { patientCode, clinicId: targetClinicId, isDeleted: false },
      select: {
        id: true,
        userId: true,
        patientCode: true,
        firstName: true,
        lastName: true,
        user: { select: { email: true, publicKey: true, isActive: true, isDeleted: true } },
      },
    })
    if (targetPatient?.user?.isDeleted || targetPatient?.user?.isActive === false) targetPatient = null
  }

  if (!targetPatient) return { error: 'Destination patient not found', status: 404 }

  const recipientsResult = await getRecordRecipients({ patientId: targetPatient.id, clinicId: targetClinicId })
  if (!recipientsResult) return { error: 'Destination patient not found', status: 404 }

  const recipients = recipientsResult.recipients
  if (!recipients.some((r) => r.userId === targetPatient.userId)) {
    return { error: 'Destination patient must sign in once before encrypted records can be transferred', status: 400 }
  }

  return {
    targetClinic,
    targetPatient: {
      id: targetPatient.id,
      userId: targetPatient.userId,
      patientCode: targetPatient.patientCode,
      firstName: targetPatient.firstName,
      lastName: targetPatient.lastName,
      email: targetPatient.user?.email ?? null,
    },
    recipients,
  }
}
