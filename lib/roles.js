/**
 * lib/roles.js — Numeric role hierarchy
 *
 * Stored as integers in the DB:
 *   1 = ADMIN
 *   2 = DENTIST
 *   3 = RECEPTIONIST
 *   4 = PATIENT
 *
 * Lower number = higher privilege.
 * Import ROLES everywhere instead of using magic numbers.
 */

export const ROLES = {
  ADMIN:        1,
  DENTIST:      2,
  RECEPTIONIST: 3,
  PATIENT:      4,
}

/** Map a numeric role back to its display label. */
export const ROLE_LABELS = {
  1: 'ADMIN',
  2: 'DENTIST',
  3: 'RECEPTIONIST',
  4: 'PATIENT',
}
