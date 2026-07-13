import { NextResponse } from 'next/server'
import { isStepUpValid } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActivePatientContext } from '@/lib/patient-context'
import { logAudit, getRequestMeta } from '@/lib/audit'

export async function GET(request) {
  const caller = await getActivePatientContext()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!isStepUpValid(caller.session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  // records and visits are independent — fetch in parallel
  const [records, visits] = await Promise.all([
    prisma.patientRecord.findMany({
      where: { patientId: caller.patientId, clinicId: caller.clinicId, isDeleted: false },
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
        patientId: caller.patientId,
        clinicId: caller.clinicId,
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
  logAudit({ userId: caller.userId, clinicId: caller.clinicId, action: 'VIEW', entity: 'PatientRecord', entityId: caller.patientId, ipAddress: ip, userAgent })
  return NextResponse.json({ records, visits })
}
