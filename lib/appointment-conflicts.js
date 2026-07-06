/**
 * lib/appointment-conflicts.js — Atomic booking-conflict guard.
 *
 * Must be called INSIDE the prisma.$transaction that also writes the
 * appointment, as its FIRST statement (before generateAppointmentCode, so
 * advisory-lock ordering is consistent across routes). A per-clinic-per-dentist
 * transaction lock serializes concurrent bookings so two requests can't both
 * pass the overlap check and both insert. The lock auto-releases when the
 * transaction commits/rolls back — safe behind Neon's pooler in transaction
 * mode. Mirrors lib/appointments.js#generateAppointmentCode.
 */

export class BookingConflictError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BookingConflictError'
    this.code = 'BOOKING_CONFLICT'
  }
}

/**
 * @param {object} tx  Prisma transaction client
 * @param {object} args
 * @param {string} args.clinicId
 * @param {string|null} args.dentistId  null = "Any Available" (unassigned pool)
 * @param {Date}   args.scheduledAt
 * @param {Date}   args.endsAt
 * @param {string} [args.excludeId]     appointment id to ignore (PATCH reassign)
 * @throws {BookingConflictError} on overlap — routes map it to a 409
 */
export async function assertNoConflict(tx, { clinicId, dentistId, scheduledAt, endsAt, excludeId }) {
  const lockKey = `booking:${clinicId}:${dentistId ?? 'unassigned'}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5(${lockKey}), 1, 16))::bit(64)::bigint)`

  // Unassigned bookings only conflict with other unassigned ones — assigned
  // appointments don't consume "Any Available" capacity (receptionist resolves
  // the assignment at confirm time, which is also guarded by this check).
  const overlap = await tx.appointment.findFirst({
    where: {
      clinicId,
      dentistId: dentistId ?? null,
      isDeleted: false,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      scheduledAt: { lt: endsAt },
      endsAt: { gt: scheduledAt },
    },
    select: { id: true },
  })

  if (overlap) {
    throw new BookingConflictError(
      dentistId
        ? 'This dentist has a conflicting appointment at that time'
        : 'That time slot was just booked. Please pick a different time.'
    )
  }
}
