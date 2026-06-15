/**
 * lib/patients.js — Patient helpers
 */

/**
 * Generate a clinic-scoped patient code: PAT-{CLINICCODE}-{YYYY}-{#####}.
 * Must be called inside a Prisma transaction (`tx`) that also creates the Patient.
 *
 * Concurrency: a per-clinic advisory transaction lock serializes concurrent patient
 * creations so two requests can't read the same sequence and mint a duplicate code.
 * The lock auto-releases when `tx` commits/rolls back. We base the next number on the
 * highest existing sequence (not a count) so gaps from removed/cleared codes don't
 * cause collisions. Mirrors lib/billing.js#generateReceiptNumber.
 */
export async function generatePatientCode(clinicId, tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5(${clinicId}), 1, 16))::bit(64)::bigint)`

  const clinic = await tx.clinic.findUnique({ where: { id: clinicId }, select: { code: true } })
  const year = new Date().getFullYear()
  const prefix = `PAT-${clinic?.code ?? 'CLN'}-${year}-`

  const last = await tx.patient.findFirst({
    where: { clinicId, patientCode: { startsWith: prefix } },
    orderBy: { patientCode: 'desc' },
    select: { patientCode: true },
  })
  const lastSeq = last ? parseInt(last.patientCode.slice(prefix.length), 10) || 0 : 0

  return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`
}
