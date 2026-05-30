import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabase } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rateLimit'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const BUCKET   = 'clinic-documents'

// Magic-byte signatures — truth comes from the file buffer, not the client header
const SIGNATURES = [
  { mime: 'image/jpeg',      ext: 'jpg', magic: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',       ext: 'png', magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'application/pdf', ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
]

function detectType(buf) {
  for (const sig of SIGNATURES) {
    if (sig.magic.every((b, i) => buf[i] === b)) return sig
  }
  return null
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = await checkRateLimit(`${ip}:clinic-docs`, 50, 3600)
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  let formData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file     = formData.get('file')
  const category = formData.get('category')

  if (!file || !(file instanceof File))
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  if (!['bir', 'id'].includes(category))
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'File must be 5 MB or smaller.' }, { status: 400 })

  // Read buffer first so we can inspect magic bytes before touching storage
  const buffer   = Buffer.from(await file.arrayBuffer())
  const detected = detectType(buffer)

  if (!detected)
    return NextResponse.json({ error: 'Only PDF, JPG, and PNG files are accepted.' }, { status: 400 })

  // Ensure bucket exists (no-op if already present)
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})

  // Extension and content-type come from magic-byte detection, not the client
  const path = `${category}/${Date.now()}-${randomBytes(10).toString('hex')}.${detected.ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: detected.mime })

  if (uploadError)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({ url: publicUrl, name: file.name })
}
