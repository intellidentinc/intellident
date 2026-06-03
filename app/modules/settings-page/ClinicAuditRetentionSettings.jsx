'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'

const OPTIONS = [
  { value: '', label: 'Keep forever (no auto-purge)' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
]

export default function ClinicAuditRetentionSettings({ clinicId }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [value, setValue]     = useState('')

  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/clinics/${clinicId}/profile`)
      .then((r) => r.json())
      .then((data) => setValue(data.auditLogRetentionDays != null ? String(data.auditLogRetentionDays) : ''))
      .catch(() => showToast('Failed to load retention settings', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditLogRetentionDays: value === '' ? null : parseInt(value, 10) }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error ?? 'Failed to save', 'error')
        return
      }
      showToast('Retention policy saved', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 420 }}>
      <TextField
        select
        fullWidth
        size='small'
        label='Auto-purge audit logs older than'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>

      {value !== '' && (
        <Alert severity='warning' sx={{ mb: 2, borderRadius: 2 }}>
          Audit logs older than <strong>{value} days</strong> will be permanently deleted by the nightly purge job. This cannot be undone.
        </Alert>
      )}

      <Button variant='contained' onClick={handleSave} loading={saving} disabled={loading}>
        Save Retention Policy
      </Button>
    </Box>
  )
}
