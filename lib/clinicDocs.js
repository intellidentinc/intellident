/**
 * lib/clinicDocs.js — Shared helpers for clinic-application onboarding documents.
 *
 * Documents live in a PRIVATE Supabase bucket (`clinic-documents`). They are uploaded
 * under a per-category folder, persisted on the ClinicApplication as bucket-relative
 * object paths (legacy rows may hold full public/sign URLs), and served to the super
 * admin via short-lived signed URLs. These helpers are the single source of truth for
 * the bucket name, category set, field names, path normalization, and submission
 * validation — imported by the upload route, the submission route, the viewer route,
 * and the orphan-cleanup cron so the logic can never drift apart.
 */

export const DOC_BUCKET = 'clinic-documents'

// Upload category → folder name (the first path segment of every stored object).
export const DOC_CATEGORIES = ['bir', 'business_permit', 'dti_sec', 'id', 'prc_license']

// ClinicApplication array fields that hold document references.
export const DOC_FIELDS = ['birDocuments', 'businessPermitDocs', 'dtiSecDocs', 'applicantIds', 'prcLicenseDocs']

const PUBLIC_PREFIX = `/storage/v1/object/public/${DOC_BUCKET}/`
const SIGNED_PREFIX = `/storage/v1/object/sign/${DOC_BUCKET}/`

/**
 * Normalizes a stored document reference to a bucket-relative object path.
 * Accepts raw paths (current form) and legacy public/sign URLs. The URL host is
 * intentionally discarded — references are only ever resolved against our own bucket,
 * so an injected external host cannot cause a fetch elsewhere. Returns null if the
 * value cannot be reduced to an object path.
 */
export function toObjectPath(stored) {
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

/**
 * Validates a client-submitted document reference for storage: it must reduce to an
 * object path inside one of the allowed category folders, with no path traversal.
 * Accepts both raw paths and legacy public/sign URLs.
 */
export function isValidDocRef(stored) {
  const path = toObjectPath(stored)
  if (!path) return false
  if (path.includes('..') || path.includes('\\')) return false
  const slash = path.indexOf('/')
  if (slash <= 0) return false
  return DOC_CATEGORIES.includes(path.slice(0, slash))
}
