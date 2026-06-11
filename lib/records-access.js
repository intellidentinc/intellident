import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

// Resolve the caller's Dentist profile, scoped to their own clinic.
// Returns { role, clinicId, dentistId } or null. Centralizes the dentist
// resolution that the records sub-routes previously each duplicated/inlined.
export async function getRecordsDentist(session) {
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!caller || caller.role !== ROLES.DENTIST) return null

  const dentist = await prisma.dentist.findUnique({
    where: { userId: session.userId },
    select: { id: true, clinicId: true },
  })
  if (!dentist || dentist.clinicId !== caller.clinicId) return null

  return { ...caller, dentistId: dentist.id }
}

// Treating-relationship gate: a dentist may only access a patient's records if
// they have at least one CONFIRMED or COMPLETED appointment with that patient in
// the same clinic. Mirrors the gate already enforced by the records list/create
// routes (app/api/records/[patientId]/route.js).
export async function dentistTreatsPatient({ dentistId, patientId, clinicId }) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      clinicId,
      isDeleted: false,
      appointments: {
        some: { dentistId, isDeleted: false, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      },
    },
    select: { id: true },
  })
  return Boolean(patient)
}

// The set of user IDs authorized to READ a patient's records under the envelope
// scheme: the patient's own user account + every dentist with a CONFIRMED/COMPLETED
// appointment with that patient. This is the authoritative recipient set — the
// server re-derives it on every write/reshare and never trusts the client's list.
// Returns { patientUserId, readerIds: Set<string> } or null if the patient is absent.
export async function getAuthorizedReaderIds({ patientId, clinicId }) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId, isDeleted: false },
    select: {
      userId: true,
      appointments: {
        where: { isDeleted: false, status: { in: ['CONFIRMED', 'COMPLETED'] }, dentistId: { not: null } },
        select: { dentist: { select: { userId: true } } },
      },
    },
  })
  if (!patient) return null
  const readerIds = new Set([patient.userId])
  for (const appt of patient.appointments) {
    if (appt.dentist?.userId) readerIds.add(appt.dentist.userId)
  }
  return { patientUserId: patient.userId, readerIds }
}

// Resolves the authorized readers to { userId, publicKey } pairs, skipping any who
// have not yet provisioned an envelope keypair (they simply receive no wrap until
// they do — access self-heals via reshare once provisioned).
export async function getRecordRecipients({ patientId, clinicId }) {
  const authorized = await getAuthorizedReaderIds({ patientId, clinicId })
  if (!authorized) return null
  const users = await prisma.user.findMany({
    where: { id: { in: [...authorized.readerIds] }, isDeleted: false, NOT: { publicKey: null } },
    select: { id: true, publicKey: true },
  })
  return {
    patientUserId: authorized.patientUserId,
    readerIds: authorized.readerIds,
    recipients: users.map((u) => ({ userId: u.id, publicKey: u.publicKey })),
  }
}

// Validates a client-supplied set of CEK wraps for a WRITE (create / re-key on edit).
// `keys` = [{ userId, wrappedKey }] from the client; `recipientIds` = the authoritative
// Set of users that must each receive a wrap (the provisioned authorized readers).
// Requires exact coverage: no wraps to non-recipients, and no recipient left out — so a
// malicious client cannot silently drop the patient (or a dentist) from a record.
// Returns { ok: true, rows } or { ok: false, error }.
export function validateWraps({ keys, recipientIds }) {
  if (!Array.isArray(keys)) return { ok: false, error: 'keys must be an array' }
  const provided = new Map()
  for (const k of keys) {
    if (!k || typeof k.userId !== 'string' || typeof k.wrappedKey !== 'string') {
      return { ok: false, error: 'invalid key entry' }
    }
    if (!recipientIds.has(k.userId)) return { ok: false, error: 'wrap for an unauthorized recipient' }
    provided.set(k.userId, k.wrappedKey)
  }
  for (const id of recipientIds) {
    if (!provided.has(id)) return { ok: false, error: 'missing recipient wrap' }
  }
  return { ok: true, rows: [...provided].map(([userId, wrappedKey]) => ({ userId, wrappedKey })) }
}
