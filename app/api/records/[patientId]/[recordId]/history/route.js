import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!caller || caller.role !== ROLES.DENTIST) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { patientId, recordId } = await params

  const record = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: caller.clinicId, isDeleted: false },
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
