import { NextResponse } from 'next/server'
import { getSession, isStepUpValid, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { logAudit, getRequestMeta } from '@/lib/audit'

// GET /api/records/[patientId]/visits — appointment visit history for a patient (dentist-scoped)
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isStepUpValid(session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const caller = await getAuthContext()
  if (!caller || caller.role !== ROLES.DENTIST) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dentist = await prisma.dentist.findUnique({
    where: { userId: session.userId },
    select: { id: true, clinicId: true },
  })
  if (!dentist || dentist.clinicId !== caller.clinicId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { patientId } = await params

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId: dentist.clinicId, isDeleted: false },
    select: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const visits = await prisma.appointment.findMany({
    where: { patientId, clinicId: dentist.clinicId, dentistId: dentist.id, isDeleted: false },
    orderBy: { scheduledAt: 'desc' },
    select: {
      id: true,
      appointmentCode: true,
      scheduledAt: true,
      endsAt: true,
      status: true,
      notes: true,
      service: { select: { name: true } },
    },
  })

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId: dentist.clinicId, action: 'VIEW', entity: 'Appointment', entityId: patientId, ipAddress: ip, userAgent })

  return NextResponse.json({ visits })
}
