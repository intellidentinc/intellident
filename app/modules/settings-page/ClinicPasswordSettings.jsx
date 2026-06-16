'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { ROLE_LABELS, PASSWORD_EXPIRY_ROLES } from '@/lib/roles'

export default function ClinicPasswordSettings({ clinicId }) {
  const { showToast } = useToast()
  const [passwordExpiry, setPasswordExpiry]       = useState(false)
  const [expiryDays, setExpiryDays]               = useState(90)
  const [expiryRoles, setExpiryRoles]             = useState([1])
  const [singleSession, setSingleSession]         = useState(false)
  const [loading, setLoading]                     = useState(true)
  const [savingExpiry, setSavingExpiry]           = useState(false)
  const [savingSession, setSavingSession]         = useState(false)

  useEffect(() => {
    fetch(`/api/clinics/${clinicId}/profile`)
      .then((r) => r.json())
      .then((data) => {
        setPasswordExpiry(data.passwordExpiryEnabled ?? false)
        setExpiryDays(data.passwordExpiryDays ?? 90)
        setExpiryRoles(Array.isArray(data.passwordExpiryRoles) ? data.passwordExpiryRoles : [1])
        setSingleSession(data.singleSessionEnabled ?? false)
      })
      .catch(() => showToast('Failed to load security settings', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveExpiry() {
    if (passwordExpiry) {
      const days = Number(expiryDays)
      if (isNaN(days) || days < 30 || days > 365) {
        showToast('Expiry days must be between 30 and 365', 'error')
        return
      }
      if (expiryRoles.length === 0) {
        showToast('Select at least one role for password expiry', 'error')
        return
      }
    }
    setSavingExpiry(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passwordExpiryEnabled: passwordExpiry,
          passwordExpiryDays: Number(expiryDays),
          passwordExpiryRoles: expiryRoles,
        }),
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
              Enable periodic password expiry
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Selected roles will be required to change their password on a fixed schedule. They will be redirected to the change password page on sign-in if their password has expired.
            </Typography>
          </Box>
        }
        sx={{ alignItems: 'flex-start', ml: 0, mb: passwordExpiry ? 2 : 2.5 }}
      />

      {passwordExpiry && (
        <Box sx={{ ml: 0.5, mb: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography variant='body2' fontWeight={600} color='text.primary' mb={0.75}>
              Expire passwords every (days)
            </Typography>
            <TextField
              type='number'
              size='small'
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              disabled={loading}
              inputProps={{ min: 30, max: 365 }}
              sx={{ width: 160 }}
            />
          </Box>
          <Box>
            <Typography variant='body2' fontWeight={600} color='text.primary' mb={0.75}>
              Apply to roles
            </Typography>
            <Select
              multiple
              size='small'
              value={expiryRoles}
              onChange={(e) => setExpiryRoles(typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value)}
              disabled={loading}
              sx={{ minWidth: 280, maxWidth: 360 }}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((r) => (
                    <Chip key={r} label={ROLE_LABELS[r]} size='small' />
                  ))}
                </Box>
              )}
            >
              {PASSWORD_EXPIRY_ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  <Checkbox checked={expiryRoles.includes(r)} />
                  <ListItemText primary={ROLE_LABELS[r]} />
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Box>
      )}

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
