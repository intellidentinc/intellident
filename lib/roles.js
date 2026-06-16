
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

/** Roles eligible for the password-expiry policy (excludes SUPERADMIN — not clinic-bound). */
export const PASSWORD_EXPIRY_ROLES = [ROLES.ADMIN, ROLES.DENTIST, ROLES.RECEPTIONIST, ROLES.PATIENT]

/**
 * Validate + normalize a password-expiry role list from request input.
 * @returns {{ roles: number[] } | { error: string }}
 */
export function sanitizeExpiryRoles(input) {
  if (!Array.isArray(input)) return { error: 'passwordExpiryRoles must be an array' }
  const roles = []
  for (const val of input) {
    const n = parseInt(val, 10)
    if (isNaN(n) || !PASSWORD_EXPIRY_ROLES.includes(n)) {
      return { error: 'passwordExpiryRoles contains an invalid role' }
    }
    if (!roles.includes(n)) roles.push(n)
  }
  return { roles }
}
