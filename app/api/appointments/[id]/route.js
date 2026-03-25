import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyPatientStatusChange, notifyStaff } from '@/lib/notifications'

async function getCaller() {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true, id: true, firstName: true, lastName: true },
  })
  if (!caller || !['RECEPTIONIST', 'ADMIN'].includes(caller.role)) return null
  return caller
}

const ALLOWED_TRANSITIONS = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
}

export async function GET(request, { params }) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const appointment = await prisma.appointment.findFirst({
    where: { id, clinicId: caller.clinicId, isDeleted: false },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
      service: { select: { name: true, duration: true } },
      statusHistory: {
        orderBy: { changedAt: 'asc' },
        include: {
          changedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(appointment)
}

export async function PATCH(request, { params }) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { status, note } = await request.json()

  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })

  const appointment = await prisma.appointment.findFirst({
    where: { id, clinicId: caller.clinicId, isDeleted: false },
  })
  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = ALLOWED_TRANSITIONS[appointment.status] ?? []
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${appointment.status} to ${status}` },
      { status: 400 }
    )
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status,
      statusHistory: {
        create: {
          status,
          changedById: caller.id,
          note: note || null,
        },
      },
    },
    include: {
      patient: {
        include: {
          user: { select: { id: true, email: true, firstName: true } },
        },
      },
      service: { select: { name: true } },
    },
  })

  const patientUser   = updated.patient?.user
  const serviceName   = updated.service?.name ?? 'your appointment'
  const appointmentCode = appointment.appointmentCode

  // Notify patient about their status change
  if (patientUser?.id) {
    await notifyPatientStatusChange({
      userId: patientUser.id,
      clinicId: caller.clinicId,
      appointmentId: id,
      status,
      patientEmail: patientUser.email,
      patientFirstName: patientUser.firstName,
      serviceName,
      scheduledAt: appointment.scheduledAt,
      appointmentCode,
    }).catch(() => {})
  }

  // Notify staff when appointment is cancelled (patient-initiated info for staff)
  if (status === 'CANCELLED') {
    const patientName = updated.patient
      ? `${updated.patient.firstName} ${updated.patient.lastName}`.trim()
      : 'A patient'
    await notifyStaff({
      clinicId: caller.clinicId,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Appointment Cancelled',
      body: `${patientName}'s ${serviceName} appointment has been cancelled.`,
      appointmentId: id,
    }).catch(() => {})
  }

  return NextResponse.json({ appointment: updated })
}
