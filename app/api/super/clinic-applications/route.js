import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { DOC_BUCKET, DOC_FIELDS, toObjectPath } from '@/lib/clinicDocs'

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
