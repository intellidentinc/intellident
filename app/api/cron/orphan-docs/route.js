import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { DOC_BUCKET, DOC_CATEGORIES, DOC_FIELDS, toObjectPath } from '@/lib/clinicDocs'

/**
 * GET /api/cron/orphan-docs — Vercel Cron Job (daily at 03:00 UTC)
 *
 * The clinic-application document upload endpoint is public (rate-limited only), so
 * files can be uploaded without an application ever being submitted. This job deletes
 * objects in the private `clinic-documents` bucket that are older than 48h and are not
 * referenced by any ClinicApplication — preventing unbounded storage growth from
 * abandoned or abusive uploads.
 */
const ORPHAN_AGE_MS = 48 * 60 * 60 * 1000
const PAGE_SIZE = 1000

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Build the set of object paths still referenced by any application.
  const apps = await prisma.clinicApplication.findMany({
    select: DOC_FIELDS.reduce((acc, f) => ({ ...acc, [f]: true }), {}),
  })
  const referenced = new Set()
  for (const app of apps) {
    for (const field of DOC_FIELDS) {
      for (const ref of app[field] ?? []) {
        const p = toObjectPath(ref)
        if (p) referenced.add(p)
      }
    }
  }

  const cutoff = Date.now() - ORPHAN_AGE_MS
  const orphans = []
  let scanned = 0

  for (const category of DOC_CATEGORIES) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase.storage
        .from(DOC_BUCKET)
        .list(category, { limit: PAGE_SIZE, offset })
      if (error) {
        console.error(`[orphan-docs] list failed for ${category}:`, error)
        break
      }
      if (!data || data.length === 0) break

      for (const obj of data) {
        scanned++
        const path = `${category}/${obj.name}`
        const createdAt = obj.created_at ? new Date(obj.created_at).getTime() : 0
        if (createdAt < cutoff && !referenced.has(path)) orphans.push(path)
      }
      if (data.length < PAGE_SIZE) break
    }
  }

  let deleted = 0
  if (orphans.length > 0) {
    const { error } = await supabase.storage.from(DOC_BUCKET).remove(orphans)
    if (error) console.error('[orphan-docs] remove failed:', error)
    else deleted = orphans.length
  }

  return NextResponse.json({ scanned, referenced: referenced.size, deleted })
}
