import { NextResponse } from 'next/server'
import { getSession, setSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { parseJsonBody, str } from '@/lib/validate'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== ROLES.PATIENT) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const enrollments = await prisma.patient.findMany({
    where: { userId: session.userId, isDeleted: false, clinic: { isDeleted: false, isEnabled: true } },
    select: { id: true, patientCode: true, clinic: { select: { id: true, name: true, code: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ activeClinicId: session.clinicId, enrollments })
}

export async function POST(request) {
  const session = await getSession()
  if (!session || session.role !== ROLES.PATIENT) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const clinicId = str(parsed.body.clinicId, 80)
  const enrollment = await prisma.patient.findFirst({
    where: { userId: session.userId, clinicId, isDeleted: false, clinic: { isDeleted: false, isEnabled: true } },
    select: { id: true },
  })
  if (!enrollment) return NextResponse.json({ error: 'Clinic enrollment not found' }, { status: 404 })

  await setSession(
    session.userId, session.email, session.firstName, session.lastName, clinicId,
    session.rememberMe, false, false, null, null, ROLES.PATIENT, false, session.mustChangePassword,
  )
  return NextResponse.json({ clinicId })
}
