'use client'

// Client-side helpers for the asymmetric-envelope record E2EE scheme.
// The server never sees the content key (CEK), the private key, or plaintext.

import {
  generateContentKey, encryptData, decryptData,
  wrapContentKey, unwrapContentKey, importPublicKey,
} from '@/lib/crypto'

// Fetches the authorized-reader public keys for a patient's records.
async function fetchRecipients(patientId) {
  const res = await fetch(`/api/records/${patientId}/recipients`)
  if (!res.ok) throw new Error('Failed to fetch record recipients')
  const data = await res.json()
  return data.recipients ?? []
}

// Wraps a CEK to every recipient's public key → [{ userId, wrappedKey }].
async function wrapToRecipients(cek, recipients) {
  return Promise.all(
    recipients.map(async (r) => ({
      userId: r.userId,
      wrappedKey: await wrapContentKey(cek, await importPublicKey(r.publicKey)),
    }))
  )
}

// WRITE: encrypt notes under a fresh CEK and wrap that CEK to every authorized reader.
// Returns { encryptedData, dataIv, keys } ready to send to the records API.
export async function encryptRecordNotes({ notes, patientId }) {
  const cek = await generateContentKey()
  const { ciphertext, iv } = await encryptData(cek, notes, patientId)
  const recipients = await fetchRecipients(patientId)
  const keys = await wrapToRecipients(cek, recipients)
  return { encryptedData: ciphertext, dataIv: iv, keys }
}

// READ: unwrap the caller's CEK wrap with their RSA private key and decrypt the notes.
// Returns { notes, cek } — the CEK is returned so the caller can heal access (reshare).
export async function decryptRecordNotes({ wrappedKey, encryptedData, dataIv, patientId, privateKey }) {
  const cek = await unwrapContentKey(wrappedKey, privateKey)
  const notes = await decryptData(cek, encryptedData, dataIv, patientId)
  return { notes, cek }
}

// HEAL (best-effort): re-wrap an in-memory CEK to all current recipients and post them.
// The server only stores wraps for recipients that don't already have one, so this
// grants access to readers added after the record was written (or after a key reset).
export async function reshareRecord({ patientId, recordId, cek }) {
  try {
    const recipients = await fetchRecipients(patientId)
    const keys = await wrapToRecipients(cek, recipients)
    if (keys.length === 0) return
    await fetch(`/api/records/${patientId}/${recordId}/reshare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    })
  } catch {
    /* best-effort — access heals on the next holder view */
  }
}
