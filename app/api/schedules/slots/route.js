/**
 * GET /api/schedules/slots — PATIENT role only
 *
 * Returns the available 30-minute time slots for the patient booking wizard.
 * The slot computation lives in lib/slots.js (computeAvailableSlots) so this
 * endpoint and /api/ai/slots stay in sync (same timezone + conflict rules).
 *
 * Params: serviceIds (comma-separated), dentistId ('ANY' or specific ID), date (YYYY-MM-DD)
 */
import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { ROLES } from '@/lib/roles'
import { computeAvailableSlots } from '@/lib/slots'

export async function GET(request) {
  const user = await getAuthContext()
  if (!user || user.role !== ROLES.PATIENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const serviceIdsParam = searchParams.get('serviceIds') ?? searchParams.get('serviceId')
  const dentistId       = searchParams.get('dentistId')   // specific ID or 'ANY'
  const dateStr         = searchParams.get('date')         // YYYY-MM-DD

  if (!serviceIdsParam || !dentistId || !dateStr) {
    return NextResponse.json({ slots: [] })
  }

  const serviceIds = serviceIdsParam.split(',').filter(Boolean)

  const slots = await computeAvailableSlots({
    clinicId: user.clinicId,
    serviceIds,
    dentistId,
    dateStr,
  })

  return NextResponse.json({ slots })
}
