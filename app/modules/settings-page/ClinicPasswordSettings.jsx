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
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/clinics/${clinicId}/profile`)
      .then((r) => r.json())
      .then((data) => setEnabled(data.passwordExpiryEnabled ?? false))
      .catch(() => showToast('Failed to load password settings', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordExpiryEnabled: enabled }),
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
      setSaving(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
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

      <Button variant='contained' onClick={handleSave} loading={saving} disabled={loading}>
        Save Password Policy
      </Button>
    </Box>
  )
}
