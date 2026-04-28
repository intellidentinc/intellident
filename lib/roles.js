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
  SUPERADMIN:   0,
  ADMIN:        1,
  DENTIST:      2,
  RECEPTIONIST: 3,
  PATIENT:      4,
}

/** Returns true for ADMIN and SUPERADMIN — use this instead of role === ROLES.ADMIN. */
export function isAdmin(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPERADMIN
}

/** Map a numeric role back to its display label. */
export const ROLE_LABELS = {
  0: 'SUPERADMIN',
  1: 'ADMIN',
  2: 'DENTIST',
  3: 'RECEPTIONIST',
  4: 'PATIENT',
}
