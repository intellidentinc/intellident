import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })

  if (!user || user.role !== ROLES.PATIENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = await prisma.patient.findFirst({
    where: { userId: session.userId, clinicId: user.clinicId, isDeleted: false },
    select: { id: true }
  })

  if (!patient) return NextResponse.json({ error: 'Patient record not found' }, { status: 404 })

  const records = await prisma.patientRecord.findMany({
    where: { patientId: patient.id, clinicId: user.clinicId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    }
  })

  // Also fetch completed/confirmed appointments as visit history
  const visits = await prisma.appointment.findMany({
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
  })

  return NextResponse.json({ records, visits })
}
