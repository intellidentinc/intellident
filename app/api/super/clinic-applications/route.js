import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

const DOC_BUCKET    = 'clinic-documents'
const DOC_FIELDS    = ['birDocuments', 'businessPermitDocs', 'dtiSecDocs', 'applicantIds', 'prcLicenseDocs']
const PUBLIC_PREFIX  = `/storage/v1/object/public/${DOC_BUCKET}/`
const SIGNED_PREFIX  = `/storage/v1/object/sign/${DOC_BUCKET}/`

// Stored values are bucket-relative paths or legacy public URLs. Extract the object
// path so it can be re-signed regardless of which form was persisted.
function toObjectPath(stored) {
  if (typeof stored !== 'string' || !stored) return null
  try {
    const u = new URL(stored)
    for (const prefix of [PUBLIC_PREFIX, SIGNED_PREFIX]) {
      const i = u.pathname.indexOf(prefix)
      if (i !== -1) return decodeURIComponent(u.pathname.slice(i + prefix.length))
    }
    return null
  } catch {
    // Not a URL — treat as a raw object path.
    return stored.replace(/^\/+/, '')
  }
}

// Replaces stored document references with short-lived signed URLs (private bucket).
async function signApplicationDocs(applications) {
  const pathSet = new Set()
  for (const app of applications) {
    for (const field of DOC_FIELDS) {
      for (const ref of app[field] ?? []) {
        const p = toObjectPath(ref)
        if (p) pathSet.add(p)
      }
    }
  }
  if (pathSet.size === 0) return applications

  const paths = [...pathSet]
  const { data } = await supabase.storage.from(DOC_BUCKET).createSignedUrls(paths, 3600)
  const signed = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))

  return applications.map((app) => {
    const next = { ...app }
    for (const field of DOC_FIELDS) {
      next[field] = (app[field] ?? [])
        .map((ref) => {
          const p = toObjectPath(ref)
          return p ? signed.get(p) : null
        })
        .filter(Boolean)
    }
    return next
  })
}

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  if (!user || user.role !== ROLES.SUPERADMIN) return null
  return session
}

export async function GET(request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED']
  const status = validStatuses.includes(statusParam) ? statusParam : null

  const applications = await prisma.clinicApplication.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    include: { clinic: { select: { name: true } } },
  })

  const withSignedDocs = await signApplicationDocs(applications)
  return NextResponse.json(withSignedDocs)
}
