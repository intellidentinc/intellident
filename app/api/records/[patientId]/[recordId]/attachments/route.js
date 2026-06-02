import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rateLimit'

const MAX_SIZE = 5 * 1024 * 1024
const BUCKET   = 'record-attachments'

const SIGNATURES = [
  { mime: 'image/jpeg',      ext: 'jpg', magic: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',       ext: 'png', magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'application/pdf', ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },
]

function detectType(buf) {
  for (const sig of SIGNATURES) {
    if (sig.magic.every((b, i) => buf[i] === b)) return sig
  }
  return null
}

const COMPRESSED_SIGNATURES = [
  [0x50, 0x4B, 0x03, 0x04],
  [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07],
  [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C],
  [0x1F, 0x8B],
  [0x42, 0x5A, 0x68],
  [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00],
]

function isCompressed(buf) {
  return COMPRESSED_SIGNATURES.some(sig => sig.every((b, i) => buf[i] === b))
}

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

// POST /api/records/[patientId]/[recordId]/attachments
export async function POST(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dentist = await getDentistForClinic(session)
  if (!dentist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = await checkRateLimit(`${ip}:record-attach`, 30, 3600)
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const { patientId, recordId } = await params

  const record = await prisma.patientRecord.findFirst({
    where: { id: recordId, patientId, clinicId: dentist.clinicId, isDeleted: false }
  })
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  let formData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File))
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'File must be 5 MB or smaller.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  if (isCompressed(buffer))
    return NextResponse.json({ error: 'Compressed files are not allowed.' }, { status: 400 })

  const detected = detectType(buffer)
  if (!detected)
    return NextResponse.json({ error: 'Only PDF, JPG, and PNG files are accepted.' }, { status: 400 })

  // Sanitize original file name — strip path separators, limit length
  const safeFileName = file.name.replace(/[/\\]/g, '').slice(0, 255) || `file.${detected.ext}`

  await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})

  const storagePath = `${dentist.clinicId}/${patientId}/${recordId}/${Date.now()}-${randomBytes(10).toString('hex')}.${detected.ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: detected.mime })

  if (uploadError)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })

  const attachment = await prisma.attachment.create({
    data: { recordId, fileName: safeFileName, fileUrl: storagePath, mimeType: detected.mime },
    select: { id: true, fileName: true, mimeType: true, fileUrl: true, createdAt: true }
  })

  const { data: signedData } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)

  return NextResponse.json({ ...attachment, signedUrl: signedData?.signedUrl ?? null }, { status: 201 })
}
