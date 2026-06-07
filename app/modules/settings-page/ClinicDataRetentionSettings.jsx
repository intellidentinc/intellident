'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
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

export default function ClinicDataRetentionSettings({ clinicId }) {
  const { showToast } = useToast()
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [patientValue, setPatientValue]   = useState('')
  const [billingValue, setBillingValue]   = useState('')

  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/clinics/${clinicId}/profile`)
      .then((r) => r.json())
      .then((data) => {
        setPatientValue(data.patientRecordRetentionDays != null ? String(data.patientRecordRetentionDays) : '')
        setBillingValue(data.billingRetentionDays != null ? String(data.billingRetentionDays) : '')
      })
      .catch(() => showToast('Failed to load retention settings', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientRecordRetentionDays: patientValue === '' ? null : parseInt(patientValue, 10),
          billingRetentionDays:       billingValue === '' ? null : parseInt(billingValue, 10),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error ?? 'Failed to save', 'error')
        return
      }
      showToast('Data retention policy saved', 'success')
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
        label='Auto-purge patient records older than'
        value={patientValue}
        onChange={(e) => setPatientValue(e.target.value)}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>

      {patientValue !== '' && (
        <Alert severity='warning' sx={{ mb: 2, borderRadius: 2 }}>
          Soft-deleted patient records older than <strong>{patientValue} days</strong> will be permanently removed by the nightly purge job, including their history and metadata. This cannot be undone.
        </Alert>
      )}

      <TextField
        select
        fullWidth
        size='small'
        label='Auto-purge billing records older than'
        value={billingValue}
        onChange={(e) => setBillingValue(e.target.value)}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>

      {billingValue !== '' && (
        <Alert severity='warning' sx={{ mb: 2, borderRadius: 2 }}>
          Soft-deleted billing records older than <strong>{billingValue} days</strong> will be permanently removed, including all associated payments. This cannot be undone.
        </Alert>
      )}

      <Alert severity='info' sx={{ mb: 2, borderRadius: 2 }}>
        File attachments stored in Supabase Storage are not automatically removed by this purge. Contact your system administrator to arrange file cleanup after purging records.
      </Alert>

      <Button variant='contained' onClick={handleSave} loading={saving} disabled={loading}>
        Save Retention Policy
      </Button>
    </Box>
  )
}
