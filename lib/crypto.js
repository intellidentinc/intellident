// Client-side only — all crypto operations happen in the browser.
// The server never sees plaintext data, passwords, or raw keys.

const enc = new TextEncoder()
const dec = new TextDecoder()

// ─── Utilities ────────────────────────────────────────────────────────────────

export function toBase64(buffer) {
  return btoa(Array.from(new Uint8Array(buffer), (c) => String.fromCharCode(c)).join(''))
}

export function fromBase64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16))
}

// Generates a random temporary password that satisfies the password policy
// (>= 8 chars with upper, lower, digit, and special) using the Web Crypto CSPRNG.
// Used when an admin/receptionist provisions an account: the SAME value is used
// to derive the account's KEK (here, client-side) and as the login password
// (sent to the server to hash + email), so the key-wrapping password and the
// login password can never diverge. No shared/hardcoded password is ever used.
export function generateTempPassword(length = 14) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digit = '0123456789'
  const special = '!@#$%^&*'
  const all = upper + lower + digit + special

  const pick = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length]

  // Guarantee one of each required class, then fill the rest from the full set.
  const chars = [pick(upper), pick(lower), pick(digit), pick(special)]
  while (chars.length < Math.max(length, 8)) chars.push(pick(all))

  // Fisher–Yates shuffle (CSPRNG) so the guaranteed chars aren't always up front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

// ─── Key Derivation ───────────────────────────────────────────────────────────

// Derives a Key Encryption Key (KEK) from the user's password using PBKDF2.
// The KEK is used to wrap/unwrap the master key — it never leaves the client.
export async function deriveKEK(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  )
}

// ─── Master Key ───────────────────────────────────────────────────────────────

// Generates a fresh AES-GCM-256 master key for a new user.
export async function generateMasterKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Wraps (encrypts) the master key with the KEK for safe server storage.
// The server stores only the wrapped key — it cannot decrypt it without the password.
export async function wrapMasterKey(masterKey, kek) {
  const wrapped = await crypto.subtle.wrapKey('raw', masterKey, kek, 'AES-KW')
  return toBase64(wrapped)
}

// Unwraps the master key using the KEK derived from the user's password.
export async function unwrapMasterKey(wrappedKeyB64, kek) {
  const wrappedKey = fromBase64(wrappedKeyB64)
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    kek,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ─── Data Encryption ──────────────────────────────────────────────────────────

// Encrypts any string value with the master key using AES-GCM.
// patientId is bound as AAD so the ciphertext cannot be moved to another patient's record.
// Returns base64-encoded ciphertext + iv — safe to store on the server.
export async function encryptData(masterKey, plaintext, patientId) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const params = { name: 'AES-GCM', iv }
  if (patientId) params.additionalData = enc.encode(String(patientId))
  const ciphertext = await crypto.subtle.encrypt(params, masterKey, enc.encode(plaintext))
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) }
}

// Decrypts a previously encrypted value — only possible client-side with master key.
// Falls back to no-AAD decryption for records written before AAD was introduced.
export async function decryptData(masterKey, ciphertextB64, ivB64, patientId) {
  const params = { name: 'AES-GCM', iv: fromBase64(ivB64) }
  if (patientId) params.additionalData = enc.encode(String(patientId))
  try {
    return dec.decode(await crypto.subtle.decrypt(params, masterKey, fromBase64(ciphertextB64)))
  } catch (err) {
    if (!patientId) throw err
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivB64) }, masterKey, fromBase64(ciphertextB64)))
  }
}
