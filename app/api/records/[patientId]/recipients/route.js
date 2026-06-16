import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { getRecordsDentist, dentistTreatsPatient, getRecordRecipients } from '@/lib/records-access'

/**
 * GET /api/records/[patientId]/recipients
 *
 * Returns the authorized-reader public keys for a patient's records:
 *   [{ userId, publicKey }]  — the patient + every treating dentist that has a keypair.
 *
 * The writing/resharing client wraps the per-record content key (CEK) to each of
 * these public keys. Callable by any authorized reader of the patient's records
 * (a treating dentist, or the patient themselves).
 */
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patientId } = await params

  const caller = await getAuthContext()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Authorize: a treating dentist, or the patient who owns the records.
  if (caller.role === ROLES.DENTIST) {
    const dentist = await getRecordsDentist(session)
    if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!(await dentistTreatsPatient({ dentistId: dentist.dentistId, patientId, clinicId: dentist.clinicId }))) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
  } else if (caller.role === ROLES.PATIENT) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, userId: session.userId, clinicId: caller.clinicId, isDeleted: false },
      select: { id: true },
    })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await getRecordRecipients({ patientId, clinicId: caller.clinicId })
  if (!result) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  return NextResponse.json({ recipients: result.recipients })
}
