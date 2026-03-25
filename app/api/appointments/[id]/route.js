import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

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
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
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
      patient: { include: { user: { select: { id: true } } } },
      service: { select: { name: true } },
    },
  })

  // Notify the patient about status changes
  if (updated.patient?.user?.id) {
    const patientUserId = updated.patient.user.id
    const serviceName   = updated.service?.name ?? 'your appointment'
    const scheduledStr  = new Date(appointment.scheduledAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

    const NOTIF = {
      CONFIRMED:  { type: 'APPOINTMENT_CONFIRMED', title: 'Appointment Confirmed', body: `Your ${serviceName} on ${scheduledStr} has been confirmed.` },
      CANCELLED:  { type: 'APPOINTMENT_CANCELLED', title: 'Appointment Cancelled', body: `Your ${serviceName} on ${scheduledStr} has been cancelled.` },
      COMPLETED:  { type: 'APPOINTMENT_COMPLETED', title: 'Appointment Completed', body: `Your ${serviceName} on ${scheduledStr} is marked as completed. Thank you!` },
      NO_SHOW:    { type: 'APPOINTMENT_NO_SHOW',   title: 'Appointment No-show',   body: `You were marked as no-show for ${serviceName} on ${scheduledStr}.` },
    }

    const n = NOTIF[status]
    if (n) {
      await createNotification({
        userId: patientUserId,
        clinicId: caller.clinicId,
        type: n.type,
        title: n.title,
        body: n.body,
        appointmentId: id,
      })
    }
  }

  return NextResponse.json({ appointment: updated })
}
