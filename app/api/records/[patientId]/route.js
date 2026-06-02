import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { parseJsonBody, str, secret } from '@/lib/validate'

async function getDentistForClinic(session) {
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })
  if (!caller || caller.role !== ROLES.DENTIST) return null

  const dentist = await prisma.dentist.findUnique({
    where: { userId: session.userId },
    select: { id: true, clinicId: true }
  })
  if (!dentist || dentist.clinicId !== caller.clinicId) return null

  return { ...caller, dentistId: dentist.id }
}

// GET /api/records/[patientId] — list records for a patient
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getDentistForClinic(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId } = await params

  // Ensure patient belongs to same clinic and has appointment with this dentist
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      clinicId: dentist.clinicId,
      isDeleted: false,
      appointments: {
        some: { dentistId: dentist.dentistId, isDeleted: false, status: { in: ['CONFIRMED', 'COMPLETED'] } }
      }
    },
    select: { id: true, firstName: true, lastName: true, patientCode: true }
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const records = await prisma.patientRecord.findMany({
    where: { patientId, clinicId: dentist.clinicId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, encryptedData: true, dataIv: true, contentHash: true, status: true, createdAt: true, updatedAt: true,
      _count: { select: { attachments: { where: { isDeleted: false } } } }
    }
  })

  return NextResponse.json({ patient, records })
}

// POST /api/records/[patientId] — create a record
export async function POST(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getDentistForClinic(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const title         = str(parsed.body.title, 200)
  const encryptedData = secret(parsed.body.encryptedData, 65536)
  const dataIv        = secret(parsed.body.dataIv, 256)
  const contentHash   = secret(parsed.body.contentHash, 256)

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId: dentist.clinicId, isDeleted: false }
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const record = await prisma.patientRecord.create({
    data: {
      patientId,
      clinicId: dentist.clinicId,
      title,
      encryptedData: encryptedData || null,
      dataIv: dataIv || null,
      contentHash: contentHash || null,
    },
    select: { id: true, title: true, encryptedData: true, dataIv: true, contentHash: true, status: true, createdAt: true, updatedAt: true }
  })

  return NextResponse.json(record, { status: 201 })
}
