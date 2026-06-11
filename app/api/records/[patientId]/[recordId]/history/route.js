import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRecordsDentist, dentistTreatsPatient } from '@/lib/records-access'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getRecordsDentist(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, recordId } = await params

  if (!(await dentistTreatsPatient({ dentistId: dentist.dentistId, patientId, clinicId: dentist.clinicId }))) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  const record = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: dentist.clinicId, isDeleted: false },
    select: { id: true },
  })
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  const history = await prisma.recordHistory.findMany({
    where: { recordId },
    select: {
      id: true,
      diff: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ history })
}
