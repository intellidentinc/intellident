'use client'

import {
  deriveKEK, unwrapMasterKey, fromBase64,
  decryptPrivateKey, importPublicKey,
  generateKeyPair, exportPublicKey, encryptPrivateKey,
} from '@/lib/crypto'

/**
 * Post-login key loader for the asymmetric-envelope E2EE scheme.
 *
 * Given the auth response (always carries wrappedKey/keySalt; may carry the
 * envelope keypair fields) and the user's password, returns
 * { masterKey, privateKey, publicKey } for CryptoProvider.setKeys().
 *
 * If the account has no envelope keypair yet (pre-existing users, brand-new
 * signups, or a just-reset account), one is generated client-side and persisted
 * via POST /api/profile/keys (set-if-null on the server). The server never sees
 * the master key or the unwrapped private key.
 */
export async function loadOrProvisionKeys(data, password) {
  const kek = await deriveKEK(password, fromBase64(data.keySalt))
  const masterKey = await unwrapMasterKey(data.wrappedKey, kek)

  if (data.publicKey && data.encryptedPrivateKey && data.privateKeyIv) {
    try {
      const privateKey = await decryptPrivateKey(data.encryptedPrivateKey, data.privateKeyIv, masterKey)
      const publicKey = await importPublicKey(data.publicKey)
      return { masterKey, privateKey, publicKey }
    } catch {
      // Stored private key can't be decrypted with this master key (e.g. mid-reset
      // race). Fall through to provisioning rather than clobbering anything.
    }
  }

  // Generate the keypair locally so the in-memory keys are usable this session.
  const kp = await generateKeyPair()

  // During onboarding (terms not yet accepted / forced password change pending) the
  // session is gated, so POST /api/profile/keys would be rejected (403) and swallowed.
  // Persisting isn't needed for the change-password step (it only re-wraps the symmetric
  // master key); the keypair is provisioned cleanly on the post-onboarding re-login
  // (set-if-null on the server keeps it idempotent). Skip the doomed call here.
  if (data.requiresTerms || data.mustChangePassword) {
    return { masterKey, privateKey: kp.privateKey, publicKey: kp.publicKey }
  }

  // Lazy provision: encrypt the private key under the master key and persist it
  // (best-effort — retried on next login if it fails).
  const publicKeyB64 = await exportPublicKey(kp.publicKey)
  const { encryptedPrivateKey, privateKeyIv } = await encryptPrivateKey(kp.privateKey, masterKey)
  try {
    await fetch('/api/profile/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: publicKeyB64, encryptedPrivateKey, privateKeyIv }),
    })
  } catch {
    /* best-effort */
  }
  return { masterKey, privateKey: kp.privateKey, publicKey: kp.publicKey }
}
