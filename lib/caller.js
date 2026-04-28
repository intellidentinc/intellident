/**
 * lib/caller.js — Shared helper to resolve the authenticated caller.
 *
 * For regular users, clinicId comes from the DB record.
 * For SUPERADMIN (role 0), clinicId comes from the session cookie (set when
 * entering a clinic via POST /api/super/enter). This ensures all DB queries
 * are scoped to the correct clinic even though the super admin's DB clinicId is null.
 */
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

/**
 * Returns { role, clinicId, userId } for the current session user.
 * Returns null if no session or user not found.
 */
export async function getCaller() {
  const session = await getSession()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!user) return null

  const clinicId = user.role === ROLES.SUPERADMIN ? session.clinicId : user.clinicId
  return { role: user.role, clinicId, userId: session.userId }
}
