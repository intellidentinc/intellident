import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { parseJsonBody, str, secret } from '@/lib/validate'
import { supabase } from '@/lib/supabase'

const ATTACHMENT_BUCKET = 'record-attachments'

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

// GET /api/records/[patientId]/[recordId]
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getDentistForClinic(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, recordId } = await params

  const record = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: dentist.clinicId, isDeleted: false },
    select: {
      id: true, title: true, encryptedData: true, dataIv: true, contentHash: true, status: true, createdAt: true, updatedAt: true,
      attachments: { where: { isDeleted: false }, select: { id: true, fileName: true, mimeType: true, fileUrl: true, createdAt: true }, orderBy: { createdAt: 'asc' } }
    }
  })
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  // Generate 1-hour signed URLs for each attachment
  const attachments = await Promise.all(
    record.attachments.map(async (att) => {
      const { data } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(att.fileUrl, 3600)
      return { id: att.id, fileName: att.fileName, mimeType: att.mimeType, signedUrl: data?.signedUrl ?? null, createdAt: att.createdAt }
    })
  )

  return NextResponse.json({ record: { ...record, attachments } })
}

// PATCH /api/records/[patientId]/[recordId]
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getDentistForClinic(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, recordId } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const title         = parsed.body.title !== undefined ? str(parsed.body.title, 200) : undefined
  const encryptedData = parsed.body.encryptedData !== undefined ? secret(parsed.body.encryptedData, 65536) : undefined
  const dataIv        = parsed.body.dataIv !== undefined ? secret(parsed.body.dataIv, 256) : undefined
  const contentHash   = parsed.body.contentHash !== undefined ? secret(parsed.body.contentHash, 256) : undefined
  const { status }    = parsed.body

  if (parsed.body.title !== undefined && !title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const existing = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: dentist.clinicId, isDeleted: false }
  })
  if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  const validStatuses = ['ACTIVE', 'ARCHIVED']
  const record = await prisma.patientRecord.update({
    where: { id: recordId },
    data: {
      ...(title !== undefined && { title }),
      ...(encryptedData !== undefined && { encryptedData: encryptedData || null }),
      ...(dataIv !== undefined && { dataIv: dataIv || null }),
      ...(contentHash !== undefined && { contentHash: contentHash || null }),
      ...(status !== undefined && validStatuses.includes(status) && { status }),
    },
    select: { id: true, title: true, encryptedData: true, dataIv: true, contentHash: true, status: true, createdAt: true, updatedAt: true }
  })

  return NextResponse.json(record)
}

// DELETE /api/records/[patientId]/[recordId]
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getDentistForClinic(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { patientId, recordId } = await params

  const existing = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: dentist.clinicId, isDeleted: false }
  })
  if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  await prisma.patientRecord.update({
    where: { id: recordId },
    data: { isDeleted: true, deletedAt: new Date() }
  })

  return NextResponse.json({ success: true })
}
