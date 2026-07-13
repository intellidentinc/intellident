import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActivePatientContext } from '@/lib/patient-context'

export async function GET() {
  const caller = await getActivePatientContext()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const [clinics, records] = await Promise.all([
    prisma.clinic.findMany({ where: { id: { not: caller.clinicId }, isDeleted: false, isEnabled: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
    prisma.patientRecord.findMany({ where: { patientId: caller.patientId, clinicId: caller.clinicId, isDeleted: false, status: 'ACTIVE' }, select: { id: true, title: true, createdAt: true, updatedAt: true, _count: { select: { attachments: { where: { isDeleted: false } } } } }, orderBy: { createdAt: 'desc' } }),
  ])
  return NextResponse.json({ clinics, records })
}
