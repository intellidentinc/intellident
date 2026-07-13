import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyStaff } from '@/lib/notifications'
import { getActivePatientContext } from '@/lib/patient-context'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody } from '@/lib/validate'

export async function PATCH(request, { params }) {
  const caller = await getActivePatientContext()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const { id } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { status } = parsed.body

  if (status !== 'CANCELLED') {
    return NextResponse.json({ error: 'Patients can only cancel appointments' }, { status: 400 })
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, patientId: caller.patientId, clinicId: caller.clinicId, isDeleted: false },
  })
  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
    return NextResponse.json(
      { error: 'Only pending or confirmed appointments can be cancelled' },
      { status: 400 }
    )
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      statusHistory: {
        create: { status: 'CANCELLED', changedById: caller.userId },
      },
    },
    include: { service: { select: { name: true } } },
  })

  // Notify receptionists and admins that the patient cancelled.
  // Fire-and-forget via after() so the SMTP send doesn't block the response.
  const scheduledStr = new Date(appointment.scheduledAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  after(
    notifyStaff({
      clinicId: caller.clinicId,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Appointment Cancelled by Patient',
      body: `${caller.firstName} ${caller.lastName} cancelled their ${updated.service?.name ?? 'appointment'} on ${scheduledStr}.`,
      appointmentId: id,
    }).catch((err) => console.error('notifyStaff failed:', err))
  )

  logAudit({ userId: caller.userId, clinicId: caller.clinicId, action: 'UPDATE', entity: 'Appointment', entityId: id, ipAddress: ip, userAgent, metadata: { to: 'CANCELLED', source: 'patient-cancel' } })

  return NextResponse.json({ success: true })
}
