import { NextResponse, after } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyStaff } from '@/lib/notifications'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody } from '@/lib/validate'

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  // Single query — role + tenant come from the patient's user relation.
  const patient = await prisma.patient.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      clinicId: true,
      firstName: true,
      lastName: true,
      user: { select: { role: true, clinicId: true } },
    },
  })
  if (!patient || patient.user?.role !== ROLES.PATIENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const user = { role: patient.user.role, clinicId: patient.user.clinicId }

  const { id } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { status } = parsed.body

  if (status !== 'CANCELLED') {
    return NextResponse.json({ error: 'Patients can only cancel appointments' }, { status: 400 })
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, patientId: patient.id, clinicId: user.clinicId, isDeleted: false },
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
        create: { status: 'CANCELLED', changedById: session.userId },
      },
    },
    include: { service: { select: { name: true } } },
  })

  // Notify receptionists and admins that the patient cancelled.
  // Fire-and-forget via after() so the SMTP send doesn't block the response.
  const scheduledStr = new Date(appointment.scheduledAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  after(
    notifyStaff({
      clinicId: user.clinicId,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Appointment Cancelled by Patient',
      body: `${patient.firstName} ${patient.lastName} cancelled their ${updated.service?.name ?? 'appointment'} on ${scheduledStr}.`,
      appointmentId: id,
    }).catch((err) => console.error('notifyStaff failed:', err))
  )

  logAudit({ userId: session.userId, clinicId: user.clinicId, action: 'UPDATE', entity: 'Appointment', entityId: id, ipAddress: ip, userAgent, metadata: { to: 'CANCELLED', source: 'patient-cancel' } })

  return NextResponse.json({ success: true })
}
