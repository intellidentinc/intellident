import { NextResponse } from 'next/server'
import { getSession, getAuthContext, isStepUpValid } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { logAudit, getRequestMeta } from '@/lib/audit'

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getAuthContext()

  if (!user || user.role !== ROLES.PATIENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isStepUpValid(session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const patient = await prisma.patient.findFirst({
    where: { userId: session.userId, clinicId: user.clinicId, isDeleted: false },
    select: { id: true }
  })

  if (!patient) return NextResponse.json({ error: 'Patient record not found' }, { status: 404 })

  // records and visits are independent — fetch in parallel
  const [records, visits] = await Promise.all([
    prisma.patientRecord.findMany({
      where: { patientId: patient.id, clinicId: user.clinicId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    }),
    // Also fetch completed/confirmed appointments as visit history
    prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        clinicId: user.clinicId,
        isDeleted: false,
        status: { in: ['COMPLETED', 'CONFIRMED'] }
      },
      orderBy: { scheduledAt: 'desc' },
      select: {
        id: true,
        appointmentCode: true,
        scheduledAt: true,
        status: true,
        notes: true,
        service: { select: { name: true } },
        dentist: {
          select: {
            user: { select: { firstName: true, lastName: true } }
          }
        }
      }
    }),
  ])

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({ userId: session.userId, clinicId: user.clinicId, action: 'VIEW', entity: 'PatientRecord', entityId: patient.id, ipAddress: ip, userAgent })
  return NextResponse.json({ records, visits })
}
