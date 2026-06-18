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
// `extractable` defaults to false so the live session key can't be exported (XSS
// hardening); change-password passes true because re-wrapping the key under a new
// password requires exporting its raw bytes (crypto.subtle.wrapKey).
export async function unwrapMasterKey(wrappedKeyB64, kek, extractable = false) {
  const wrappedKey = fromBase64(wrappedKeyB64)
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    kek,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    extractable,
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

// Decrypts a previously encrypted value — only possible client-side with the
// content key (CEK). patientId is verified as AAD. Falls back to no-AAD
// decryption for records written before AAD was introduced.
export async function decryptData(contentKey, ciphertextB64, ivB64, patientId) {
  const params = { name: 'AES-GCM', iv: fromBase64(ivB64) }
  if (patientId) params.additionalData = enc.encode(String(patientId))
  try {
    return dec.decode(await crypto.subtle.decrypt(params, contentKey, fromBase64(ciphertextB64)))
  } catch (err) {
    if (!patientId) throw err
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivB64) }, contentKey, fromBase64(ciphertextB64)))
  }
}

// ─── Asymmetric Envelope Encryption (multi-reader E2EE) ─────────────────────────
//
// Each user owns an RSA-OAEP keypair: the public key is stored in plaintext on the
// server; the private key is encrypted under the user's master key (which is itself
// wrapped by the password-derived KEK — see wrapMasterKey). Each patient record gets
// a fresh symmetric content key (CEK); the notes are encrypted with the CEK, and the
// CEK is wrapped to the public key of every authorized reader (patient + treating
// dentists). The server never sees the CEK, the private key, or any plaintext.

const RSA_PARAMS = { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }

// Generates a user's RSA-OAEP keypair (for wrapping/unwrapping content keys).
export async function generateKeyPair() {
  return crypto.subtle.generateKey(RSA_PARAMS, true, ['wrapKey', 'unwrapKey'])
}

// Exports a public key to base64 (SPKI) for plaintext server storage.
export async function exportPublicKey(publicKey) {
  return toBase64(await crypto.subtle.exportKey('spki', publicKey))
}

// Imports a base64 (SPKI) public key for wrapping a content key to a recipient.
export async function importPublicKey(spkiB64) {
  return crypto.subtle.importKey('spki', fromBase64(spkiB64), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['wrapKey'])
}

// Generates a fresh per-record AES-GCM content key (CEK). Extractable so it can be
// wrapped to each authorized reader's public key.
export async function generateContentKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

// Wraps (encrypts) a content key to a recipient's public key. Returns base64.
export async function wrapContentKey(contentKey, recipientPublicKey) {
  const wrapped = await crypto.subtle.wrapKey('raw', contentKey, recipientPublicKey, { name: 'RSA-OAEP' })
  return toBase64(wrapped)
}

// Unwraps a content key with the caller's RSA private key. Returns an AES-GCM CryptoKey
// usable for both decrypt (read) and encrypt (reshare to new readers).
export async function unwrapContentKey(wrappedB64, privateKey) {
  return crypto.subtle.unwrapKey(
    'raw',
    fromBase64(wrappedB64),
    privateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Encrypts a user's RSA private key (PKCS8) under their master key for server storage.
export async function encryptPrivateKey(privateKey, masterKey) {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, pkcs8)
  return { encryptedPrivateKey: toBase64(ciphertext), privateKeyIv: toBase64(iv) }
}

// Decrypts and imports the user's RSA private key using their master key.
export async function decryptPrivateKey(encryptedPrivateKeyB64, privateKeyIvB64, masterKey) {
  const pkcs8 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(privateKeyIvB64) },
    masterKey,
    fromBase64(encryptedPrivateKeyB64)
  )
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['unwrapKey'])
}
