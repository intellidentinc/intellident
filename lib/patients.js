/**
 * lib/patients.js — Patient helpers
 */

/**
 * Generate a clinic-scoped patient code: PAT-{CLINICCODE}-{YYYY}-{#####}.
 * Must be called inside a Prisma transaction (`tx`) that also creates the Patient,
 * so the count-based sequence stays consistent.
 */
export async function generatePatientCode(clinicId, tx) {
  const clinic = await tx.clinic.findUnique({ where: { id: clinicId }, select: { code: true } })
  const year = new Date().getFullYear()
  const existingCount = await tx.patient.count({ where: { clinicId } })
  return `PAT-${clinic?.code ?? 'CLN'}-${year}-${String(existingCount + 1).padStart(5, '0')}`
}
