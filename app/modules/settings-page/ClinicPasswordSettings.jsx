'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'

export default function ClinicPasswordSettings({ clinicId }) {
  const { showToast } = useToast()
  const [passwordExpiry, setPasswordExpiry]       = useState(false)
  const [singleSession, setSingleSession]         = useState(false)
  const [loading, setLoading]                     = useState(true)
  const [savingExpiry, setSavingExpiry]           = useState(false)
  const [savingSession, setSavingSession]         = useState(false)

  useEffect(() => {
    fetch(`/api/clinics/${clinicId}/profile`)
      .then((r) => r.json())
      .then((data) => {
        setPasswordExpiry(data.passwordExpiryEnabled ?? false)
        setSingleSession(data.singleSessionEnabled ?? false)
      })
      .catch(() => showToast('Failed to load security settings', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveExpiry() {
    setSavingExpiry(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordExpiryEnabled: passwordExpiry }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error ?? 'Failed to save', 'error')
        return
      }
      showToast('Password policy saved', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSavingExpiry(false)
    }
  }

  async function handleSaveSession() {
    setSavingSession(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ singleSessionEnabled: singleSession }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error ?? 'Failed to save', 'error')
        return
      }
      showToast('Session policy saved', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSavingSession(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      <FormControlLabel
        control={
          <Switch
            checked={passwordExpiry}
            onChange={(e) => setPasswordExpiry(e.target.checked)}
            disabled={loading}
            color='primary'
          />
        }
        label={
          <Box sx={{ ml: 0.5 }}>
            <Typography variant='body2' fontWeight={600} color='text.primary'>
              Enable 90-day password expiry for Admin accounts
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Admin users will be required to change their password every 90 days. They will be redirected to the change password page on sign-in if their password has expired.
            </Typography>
          </Box>
        }
        sx={{ alignItems: 'flex-start', ml: 0, mb: 2.5 }}
      />

      <Button variant='contained' onClick={handleSaveExpiry} loading={savingExpiry} disabled={loading} sx={{ mb: 4 }}>
        Save Password Policy
      </Button>

      <FormControlLabel
        control={
          <Switch
            checked={singleSession}
            onChange={(e) => setSingleSession(e.target.checked)}
            disabled={loading}
            color='primary'
          />
        }
        label={
          <Box sx={{ ml: 0.5 }}>
            <Typography variant='body2' fontWeight={600} color='text.primary'>
              Enforce single active session per user
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              When enabled, signing in on a new device or browser will automatically terminate all other active sessions for that user.
            </Typography>
          </Box>
        }
        sx={{ alignItems: 'flex-start', ml: 0, mb: 2.5 }}
      />

      <Button variant='contained' onClick={handleSaveSession} loading={savingSession} disabled={loading}>
        Save Session Policy
      </Button>
    </Box>
  )
}
