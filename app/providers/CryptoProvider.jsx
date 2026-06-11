/**
 * CryptoProvider — E2EE Master Key Memory Store
 *
 * Holds the AES-GCM-256 master key in React state (browser memory only).
 * This is the client-side half of the E2EE architecture:
 *
 *   Sign-in flow:
 *     1. Server returns wrappedKey + keySalt
 *     2. Browser derives KEK from password + keySalt via PBKDF2 (lib/crypto.js)
 *     3. Browser unwraps the master key using the KEK
 *     4. masterKey is stored here via setMasterKey()
 *
 *   Usage: import { useCrypto } then call encryptData / decryptData (lib/crypto.js)
 *   Cleared: on sign-out, on inactivity timeout (InactivityProvider), and on
 *            role-change or account deletion that triggers a forced redirect.
 *
 * The server never sees the plaintext master key — only the wrapped (encrypted) blob.
 */
'use client'

import { createContext, useContext, useState } from 'react'

// Holds the decrypted master key in memory for the duration of the session.
// The key is set after login and cleared on sign-out — never persisted to disk.
const CryptoContext = createContext(null)

export function useCrypto() {
  const context = useContext(CryptoContext)
  if (!context) throw new Error('useCrypto must be used within CryptoProvider')
  return context
}

export default function CryptoProvider({ children }) {
  const [masterKey, setMasterKey] = useState(null)
  // Asymmetric envelope keys: the RSA private key unwraps per-record content keys (CEKs);
  // the public key wraps CEKs to this user. Both held in memory only, cleared on sign-out.
  const [privateKey, setPrivateKey] = useState(null)
  const [publicKey, setPublicKey] = useState(null)

  // Sets all three keys at once after login/unwrap.
  const setKeys = ({ masterKey: mk = null, privateKey: pk = null, publicKey: pub = null }) => {
    setMasterKey(mk)
    setPrivateKey(pk)
    setPublicKey(pub)
  }

  const clearKey = () => {
    setMasterKey(null)
    setPrivateKey(null)
    setPublicKey(null)
  }

  return (
    <CryptoContext.Provider value={{ masterKey, setMasterKey, privateKey, setPrivateKey, publicKey, setPublicKey, setKeys, clearKey }}>
      {children}
    </CryptoContext.Provider>
  )
}
