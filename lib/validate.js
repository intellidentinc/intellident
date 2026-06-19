/**
 * Input validation / sanitization helpers for API routes.
 *
 * Goals:
 *  - Reject oversized payloads before they touch the DB
 *  - Enforce types and length bounds on every field
 *  - Normalize emails to lowercase
 */

const MAX_BODY_BYTES = 16 * 1024; // 16 KB — generous for all auth payloads

/**
 * Reads the request body, enforces the size cap, and parses JSON.
 * Returns { body } on success or { error, status } on failure.
 */
export async function parseJsonBody(request) {
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return { error: 'Payload too large', status: 413 };
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return { error: 'Failed to read request body', status: 400 };
  }

  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    return { error: 'Payload too large', status: 413 };
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: 'Invalid JSON', status: 400 };
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid request body', status: 400 };
  }

  return { body };
}

/**
 * Trims and length-checks a non-secret string (names, IDs, etc.).
 * Returns the trimmed string, or null if invalid / too long / empty.
 */
export function str(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLen ? trimmed : null;
}

/**
 * Length-checks a secret string (passwords, key material) WITHOUT trimming —
 * leading/trailing whitespace is valid in passwords.
 * Returns the string as-is, or null if invalid / too long / empty.
 */
export function secret(value, maxLen) {
  if (typeof value !== 'string') return null;
  return value.length > 0 && value.length <= maxLen ? value : null;
}

/**
 * Validates an email address: trims, lowercases, enforces RFC 5321 max length,
 * and rejects obviously malformed addresses.
 * Returns the normalized email, or null if invalid.
 */
export function sanitizeEmail(value) {
  const s = str(value, 254);
  if (!s) return null;
  // Basic structure check: local@domain.tld — no whitespace, at least one dot in domain
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : null;
}

/**
 * Coerces a value to boolean. Anything other than a literal true is treated as false.
 */
export function bool(value) {
  return value === true;
}

/**
 * Validates a 64-character lowercase hex token (output of randomBytes(32).toString('hex')).
 * Returns the token, or null if it does not match.
 */
export function hexToken(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return /^[a-f0-9]{64}$/.test(s) ? s : null;
}

/* ------------------------------------------------------------------ *
 * Query-string (searchParams) helpers
 *
 * Query params are user input too — they need bounding/validation
 * before they reach the DB. parseInt/new Date on raw values can yield
 * NaN / Invalid Date, which either skews queries or makes Prisma throw
 * a 500. Unbounded pagination is a resource-exhaustion vector.
 * ------------------------------------------------------------------ */

/**
 * Parses an integer query param and clamps it to [min, max].
 * Falls back to `def` when the value is missing or not a finite number.
 */
export function intParam(value, def, min, max) {
  const n = parseInt(value ?? '', 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/**
 * Parses `page` + `pageSize` query params into safe, clamped values.
 * page  >= 0, default 0
 * pageSize in [1, maxSize], default defaultSize
 */
export function pageParams(searchParams, { defaultSize = 10, maxSize = 100 } = {}) {
  const page = intParam(searchParams.get('page'), 0, 0, Number.MAX_SAFE_INTEGER);
  const pageSize = intParam(searchParams.get('pageSize'), defaultSize, 1, maxSize);
  return { page, pageSize };
}

/**
 * Normalizes a free-text search/filter param: trims and caps length so an
 * attacker can't push pathologically long strings into Prisma `contains`.
 * Returns '' when missing/blank (filters that should simply be skipped).
 */
export function searchTerm(value, maxLen = 100) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

/**
 * Parses a date query param. Returns a valid Date or null — never an
 * "Invalid Date", which would make Prisma throw at query time.
 */
export function safeDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
