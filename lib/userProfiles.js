/**
 * lib/userProfiles.js — Role ↔ profile-row reconciliation
 *
 * Each clinic-scoped role has a matching profile row keyed by a @unique userId:
 *   DENTIST → Dentist, RECEPTIONIST → Receptionist, PATIENT → Patient.
 * ADMIN/SUPERADMIN have no profile row.
 *
 * Keeping these in sync is required because the rest of the app resolves a user's
 * capabilities through their profile row (e.g. prisma.dentist.findUnique({ where:{ userId } })).
 */

import { ROLES } from '@/lib/roles'
import { generatePatientCode } from '@/lib/patients'

/**
 * Ensure `userId`'s profile rows match `role`, inside an open Prisma transaction (`tx`).
 * Soft-deletes any active profile rows for the other role types, then reactivates or
 * creates the profile row for the target role. No-op for ADMIN/SUPERADMIN.
 */
export async function reconcileRoleProfile(tx, { userId, role, clinicId, firstName, lastName }) {
  // Retire any active profile rows that don't belong to the new role.
  if (role !== ROLES.PATIENT) {
    await tx.patient.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true, deletedAt: new Date() } })
  }
  if (role !== ROLES.DENTIST) {
    await tx.dentist.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true, deletedAt: new Date() } })
  }
  if (role !== ROLES.RECEPTIONIST) {
    await tx.receptionist.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true, deletedAt: new Date() } })
  }

  // Ensure the new role's profile exists. The @unique userId means we must reactivate
  // a previously soft-deleted row rather than create a duplicate.
  if (role === ROLES.DENTIST) {
    const existing = await tx.dentist.findUnique({ where: { userId }, select: { id: true } })
    if (existing) {
      await tx.dentist.update({ where: { userId }, data: { isDeleted: false, deletedAt: null, clinicId } })
    } else {
      await tx.dentist.create({ data: { userId, clinicId } })
    }
  } else if (role === ROLES.RECEPTIONIST) {
    const existing = await tx.receptionist.findUnique({ where: { userId }, select: { id: true } })
    if (existing) {
      await tx.receptionist.update({ where: { userId }, data: { isDeleted: false, deletedAt: null, clinicId } })
    } else {
      await tx.receptionist.create({ data: { userId, clinicId } })
    }
  } else if (role === ROLES.PATIENT) {
    const existing = await tx.patient.findUnique({ where: { userId }, select: { id: true } })
    if (existing) {
      await tx.patient.update({ where: { userId }, data: { isDeleted: false, deletedAt: null, clinicId } })
    } else {
      const patientCode = await generatePatientCode(clinicId, tx)
      await tx.patient.create({
        data: {
          userId,
          clinicId,
          firstName: firstName || '',
          lastName: lastName || '',
          patientCode,
        },
      })
    }
  }
}
