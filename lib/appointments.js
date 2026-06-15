/**
 * lib/appointments.js — Appointment helpers
 */

/**
 * Generate a clinic-scoped appointment code: APT-{CLINICCODE}-{YYYY/MM/DD}-{####}.
 * Must be called inside a Prisma transaction (`tx`) that also creates the Appointment.
 *
 * Concurrency: a per-clinic-per-day advisory transaction lock serializes concurrent
 * bookings for the same day so two requests can't read the same sequence and mint a
 * duplicate code. The lock auto-releases when `tx` commits/rolls back. We base the next
 * number on the highest existing sequence for that clinic/day (not a count) so gaps
 * don't cause collisions. Mirrors lib/billing.js#generateReceiptNumber.
 */
export async function generateAppointmentCode(clinicId, clinicCode, datePart, tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5(${clinicId} || ${datePart}), 1, 16))::bit(64)::bigint)`

  const prefix = `APT-${clinicCode ?? 'CLN'}-${datePart}-`

  const last = await tx.appointment.findFirst({
    where: { clinicId, appointmentCode: { startsWith: prefix } },
    orderBy: { appointmentCode: 'desc' },
    select: { appointmentCode: true },
  })
  const lastSeq = last ? parseInt(last.appointmentCode.slice(prefix.length), 10) || 0 : 0

  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}
