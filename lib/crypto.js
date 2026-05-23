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
// Returns base64-encoded ciphertext + iv — safe to store on the server.
export async function encryptData(masterKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    enc.encode(plaintext)
  )
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) }
}

// Decrypts a previously encrypted value — only possible client-side with master key.
export async function decryptData(masterKey, ciphertextB64, ivB64) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivB64) },
    masterKey,
    fromBase64(ciphertextB64)
  )
  return dec.decode(plaintext)
}
