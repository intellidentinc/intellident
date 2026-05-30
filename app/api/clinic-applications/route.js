import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseJsonBody, str, sanitizeEmail } from '@/lib/validate'
import { checkRateLimit } from '@/lib/rateLimit'
import { sendClinicApplicationReceived } from '@/lib/email'

const PHONE_RE   = /^\+63\d{10}$/
const MAX_DOCS   = 5
const BUCKET     = 'clinic-documents'

// Validate that a URL points to our own Supabase storage bucket — rejects arbitrary external URLs
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
}
const SUPABASE_ORIGIN   = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
const DOC_PATH_PREFIX   = `/storage/v1/object/public/${BUCKET}/`

function isOwnStorageUrl(url) {
  try {
    const u = new URL(url)
    return u.origin === SUPABASE_ORIGIN && u.pathname.startsWith(DOC_PATH_PREFIX)
  } catch { return false }
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = await checkRateLimit(`${ip}:clinic-apply`, 5, 3600)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { body } = parsed

  const clinicName          = str(body.clinicName, 200)
  const businessAddress     = str(body.businessAddress, 500)
  const businessPhone       = str(body.businessPhone, 20)
  const businessEmail       = sanitizeEmail(body.businessEmail)
  const contactPersonName   = str(body.contactPersonName, 200)
  const contactPersonPhone  = str(body.contactPersonPhone, 20)
  const contactPersonEmail  = sanitizeEmail(body.contactPersonEmail) ?? null
  const message             = str(body.message, 500) ?? null
  const birDocuments = Array.isArray(body.birDocuments)
    ? body.birDocuments.filter(isOwnStorageUrl).slice(0, MAX_DOCS)
    : []
  const applicantIds = Array.isArray(body.applicantIds)
    ? body.applicantIds.filter(isOwnStorageUrl).slice(0, MAX_DOCS)
    : []

  if (!clinicName)               return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 })
  if (!businessAddress)          return NextResponse.json({ error: 'Business address is required' }, { status: 400 })
  if (!businessPhone)            return NextResponse.json({ error: 'Business phone is required' }, { status: 400 })
  if (!businessEmail)            return NextResponse.json({ error: 'Business email is required' }, { status: 400 })
  if (!contactPersonName)        return NextResponse.json({ error: 'Contact person name is required' }, { status: 400 })
  if (!contactPersonPhone)       return NextResponse.json({ error: 'Contact person phone is required' }, { status: 400 })
  if (!contactPersonEmail)       return NextResponse.json({ error: 'Contact email is required' }, { status: 400 })
  if (birDocuments.length === 0) return NextResponse.json({ error: 'At least one BIR document is required' }, { status: 400 })
  if (applicantIds.length === 0) return NextResponse.json({ error: 'At least one applicant ID is required' }, { status: 400 })

  if (!PHONE_RE.test(businessPhone)) {
    return NextResponse.json({ error: 'Business phone must be in +63XXXXXXXXXX format' }, { status: 400 })
  }
  if (!PHONE_RE.test(contactPersonPhone)) {
    return NextResponse.json({ error: 'Contact person phone must be in +63XXXXXXXXXX format' }, { status: 400 })
  }

  try {
    await prisma.clinicApplication.create({
      data: { clinicName, businessAddress, businessPhone, businessEmail, contactPersonName, contactPersonPhone, contactPersonEmail, birDocuments, applicantIds, message },
    })

    sendClinicApplicationReceived({
      clinicName,
      applicantName: contactPersonName,
      email: businessEmail,
    }).catch(() => {})

    return NextResponse.json({ message: 'Application submitted.' }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to submit application. Please try again.' }, { status: 500 })
  }
}
