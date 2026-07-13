import { cache } from 'react'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

// Authoritative resolver for a patient's currently selected clinic enrollment.
// Patient identity is global, but every clinical operation must use the Patient row
// belonging to the clinic carried by the signed session.
export const getActivePatientContext = cache(async function getActivePatientContext() {
  const session = await getSession()
  if (!session || session.role !== ROLES.PATIENT || !session.clinicId) return null

  const patient = await prisma.patient.findUnique({
    where: { userId_clinicId: { userId: session.userId, clinicId: session.clinicId } },
    select: {
      id: true,
      clinicId: true,
      patientCode: true,
      firstName: true,
      lastName: true,
      isDeleted: true,
      user: { select: { id: true, role: true, isDeleted: true, isActive: true } },
      clinic: { select: { isDeleted: true, isEnabled: true } },
    },
  })

  if (
    !patient || patient.isDeleted || patient.user.isDeleted || !patient.user.isActive ||
    patient.user.role !== ROLES.PATIENT || patient.clinic.isDeleted || !patient.clinic.isEnabled
  ) return null

  return {
    session,
    role: ROLES.PATIENT,
    userId: session.userId,
    clinicId: patient.clinicId,
    patientId: patient.id,
    patientCode: patient.patientCode,
    firstName: patient.firstName,
    lastName: patient.lastName,
  }
})
