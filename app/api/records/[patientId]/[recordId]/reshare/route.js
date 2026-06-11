import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { getRecordsDentist, dentistTreatsPatient, getRecordRecipients } from '@/lib/records-access'

/**
 * POST /api/records/[patientId]/[recordId]/reshare
 *
 * Heals access for authorized readers who lack a CEK wrap (e.g. a dentist who began
 * treating the patient after the record was written, or a patient whose keypair was
 * regenerated after a password reset). The caller — any current key-holder authorized
 * to read the record (a treating dentist or the patient) — unwraps the CEK locally and
 * re-wraps it to the missing recipients' public keys, posting the new wraps here.
 *
 * The server re-derives the authoritative recipient set and only stores wraps for
 * recipients in it that don't already have one. It never sees the CEK.
 */
export async function POST(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patientId, recordId } = await params

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Authorize: a treating dentist, or the patient who owns the record.
  if (caller.role === ROLES.DENTIST) {
    const dentist = await getRecordsDentist(session)
    if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!(await dentistTreatsPatient({ dentistId: dentist.dentistId, patientId, clinicId: dentist.clinicId }))) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
  } else if (caller.role === ROLES.PATIENT) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, userId: session.userId, clinicId: caller.clinicId, isDeleted: false },
      select: { id: true },
    })
    if (!patient) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Confirm the record exists in the caller's clinic.
  const record = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: caller.clinicId, isDeleted: false },
    select: { id: true },
  })
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!Array.isArray(body.keys)) return NextResponse.json({ error: 'keys must be an array' }, { status: 400 })

  // Re-derive the authoritative recipient set; only accept wraps for those users.
  const result = await getRecordRecipients({ patientId, clinicId: caller.clinicId })
  if (!result) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  const recipientIds = new Set(result.recipients.map((r) => r.userId))

  const existing = await prisma.recordKey.findMany({ where: { recordId }, select: { userId: true } })
  const have = new Set(existing.map((r) => r.userId))

  const toCreate = []
  for (const k of body.keys) {
    if (!k || typeof k.userId !== 'string' || typeof k.wrappedKey !== 'string') continue
    if (!recipientIds.has(k.userId) || have.has(k.userId)) continue
    toCreate.push({ recordId, userId: k.userId, wrappedKey: k.wrappedKey })
    have.add(k.userId)
  }

  if (toCreate.length > 0) {
    await prisma.recordKey.createMany({ data: toCreate, skipDuplicates: true })
  }
  return NextResponse.json({ ok: true, added: toCreate.length })
}
