import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!user || user.role !== 'PATIENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = await prisma.patient.findUnique({ where: { userId: session.userId } })
  if (!patient) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { status } = await request.json()

  if (status !== 'CANCELLED') {
    return NextResponse.json({ error: 'Patients can only cancel appointments' }, { status: 400 })
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, patientId: patient.id, clinicId: user.clinicId, isDeleted: false },
  })
  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (appointment.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Only pending appointments can be cancelled by patients' },
      { status: 400 }
    )
  }

  await prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      statusHistory: {
        create: { status: 'CANCELLED', changedById: session.userId },
      },
    },
  })

  return NextResponse.json({ success: true })
}
