import { NextResponse } from 'next/server'
import { getSession, isStepUpValid } from '@/lib/auth'
import { parseJsonBody, str } from '@/lib/validate'
import { getSourceRecord, getTransferDentist, resolveTransferTarget } from '../helpers'

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isStepUpValid(session)) return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })

  const dentist = await getTransferDentist(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const sourcePatientId = str(parsed.body.sourcePatientId, 80)
  const sourceRecordId = str(parsed.body.sourceRecordId, 80)
  const targetClinicId = str(parsed.body.targetClinicId, 80)
  const targetPatientIdentifier = str(parsed.body.targetPatientIdentifier, 254)

  if (!sourcePatientId || !sourceRecordId || !targetClinicId || !targetPatientIdentifier) {
    return NextResponse.json({ error: 'Missing transfer details' }, { status: 400 })
  }

  const sourceRecord = await getSourceRecord({ dentist, sourcePatientId, sourceRecordId })
  if (!sourceRecord) return NextResponse.json({ error: 'Source record not found' }, { status: 404 })

  const target = await resolveTransferTarget({
    sourceClinicId: dentist.clinicId,
    targetClinicId,
    targetPatientIdentifier,
  })
  if (target.error) return NextResponse.json({ error: target.error }, { status: target.status })

  return NextResponse.json({
    sourceRecord,
    targetClinic: target.targetClinic,
    targetPatient: target.targetPatient,
    recipients: target.recipients,
  })
}
