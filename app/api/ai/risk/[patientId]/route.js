import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

const RISK_THRESHOLD = parseInt(process.env.NOSHOW_RISK_THRESHOLD ?? '2', 10)

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()

  // Staff only (role 1–3); role comes from DB, not the cookie
  if (!caller || caller.role > 3) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId } = await params
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  if (!clinicId) return NextResponse.json({ error: 'No clinic selected' }, { status: 400 })

  // Verify patient belongs to this clinic
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId, isDeleted: false },
    select: { id: true, firstName: true, lastName: true },
  })

  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  // Count total no-shows
  const noShowCount = await prisma.appointment.count({
    where: { patientId, clinicId, isDeleted: false, status: 'NO_SHOW' },
  })

  // Check if most recent booking was made <24h before the appointment
  const recentAppointment = await prisma.appointment.findFirst({
    where: {
      patientId,
      clinicId,
      isDeleted: false,
      status: { in: ['PENDING', 'CONFIRMED'] },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    select: { scheduledAt: true, createdAt: true },
  })

  const isLastMinuteBooking =
    recentAppointment != null &&
    recentAppointment.scheduledAt.getTime() - recentAppointment.createdAt.getTime() < 24 * 60 * 60 * 1000

  const isHighRisk = noShowCount >= RISK_THRESHOLD || isLastMinuteBooking

  const reasons = []
  if (noShowCount >= RISK_THRESHOLD) {
    reasons.push(`${noShowCount} previous no-show${noShowCount !== 1 ? 's' : ''} (threshold: ${RISK_THRESHOLD})`)
  }
  if (isLastMinuteBooking) {
    reasons.push('Appointment booked less than 24 hours in advance')
  }

  const suggestions = isHighRisk
    ? ['Require confirmation call before appointment', 'Send an extra reminder 1 hour before']
    : []

  return NextResponse.json({
    risk: isHighRisk ? 'HIGH' : 'LOW',
    noShowCount,
    isLastMinuteBooking,
    reasons,
    suggestions,
  })
}
