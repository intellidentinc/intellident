import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET() {
  const session = await getSession()
  const caller = await getAuthContext()
  if (!session || !caller || caller.role !== ROLES.PATIENT) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const patient = await prisma.patient.findUnique({ where: { userId_clinicId: { userId: session.userId, clinicId: caller.clinicId } }, select: { id: true } })
  if (!patient) return NextResponse.json({ error: 'Patient enrollment not found' }, { status: 404 })
  const [clinics, records] = await Promise.all([
    prisma.clinic.findMany({ where: { id: { not: caller.clinicId }, isDeleted: false, isEnabled: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
    prisma.patientRecord.findMany({ where: { patientId: patient.id, clinicId: caller.clinicId, isDeleted: false, status: 'ACTIVE' }, select: { id: true, title: true, createdAt: true, updatedAt: true, _count: { select: { attachments: { where: { isDeleted: false } } } } }, orderBy: { createdAt: 'desc' } }),
  ])
  return NextResponse.json({ clinics, records })
}
