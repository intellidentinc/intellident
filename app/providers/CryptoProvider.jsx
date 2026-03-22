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

  const clearKey = () => setMasterKey(null)

  return (
    <CryptoContext.Provider value={{ masterKey, setMasterKey, clearKey }}>
      {children}
    </CryptoContext.Provider>
  )
}
