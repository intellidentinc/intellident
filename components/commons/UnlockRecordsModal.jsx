'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { LockOutlined } from '@mui/icons-material'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'
import { useCrypto } from '@/app/providers/CryptoProvider'
import { loadOrProvisionKeys } from '@/lib/clientKeys'

/**
 * UnlockRecordsModal — re-derive the in-memory E2EE keys after a page reload.
 *
 * The decrypted keys live only in CryptoProvider's React state and are wiped on any
 * full reload, while the session cookie stays valid. Rather than forcing a full
 * re-login (which the still-valid session just bounces back to the dashboard), this
 * prompts for the account password, fetches the wrapped key material from
 * GET /api/profile/keys, and re-derives the keys locally via loadOrProvisionKeys.
 * Nothing is persisted to disk; a wrong password simply fails the unwrap.
 */
export default function UnlockRecordsModal({ open, onClose, onUnlocked }) {
  const { showToast } = useToast()
  const { setKeys } = useCrypto()

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUnlock() {
    if (!password) {
      setError('Please enter your account password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/profile/keys')
      if (!res.ok) {
        showToast('Could not load your encryption keys. Please sign in again.', 'error')
        return
      }
      const data = await res.json()

      let keys
      try {
        keys = await loadOrProvisionKeys(data, password)
      } catch {
        setError('Incorrect password. Please try again.')
        return
      }

      setKeys(keys)
      setPassword('')
      onUnlocked?.()
    } catch {
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setPassword('')
    setError('')
    onClose?.()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='xs'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 2, bgcolor: '#fef9c3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, mt: 0.25,
          }}
        >
          <LockOutlined sx={{ fontSize: 20, color: '#92400e' }} />
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            Unlock your records
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            Your records are end-to-end encrypted. Enter your account password to unlock them for this session.
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Input
          id='unlock-password'
          label='Account password'
          type='password'
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock() }}
          placeholder='Enter your password'
          error={!!error}
          helperText={error}
          autoFocus
          required
        />
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant='contained' onClick={handleUnlock} loading={loading}>
          Unlock
        </Button>
      </Box>
    </Dialog>
  )
}
