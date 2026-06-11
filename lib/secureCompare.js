import crypto from 'crypto'

/**
 * Constant-time string comparison. Returns false for non-strings or
 * length mismatches without leaking timing about how much matched.
 */
export function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}
