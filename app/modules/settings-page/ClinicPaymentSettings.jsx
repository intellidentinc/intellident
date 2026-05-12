'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'

export default function ClinicPaymentSettings({ clinicId }) {
  const { showToast } = useToast()

  const [enabled, setEnabled]         = useState(false)
  const [feeAmount, setFeeAmount]     = useState('')
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [feeError, setFeeError]       = useState('')

  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/clinics/${clinicId}/profile`)
      .then(r => r.json())
      .then(data => {
        setEnabled(data.paymongoEnabled ?? false)
        setFeeAmount(data.reservationFeeAmount != null ? String(data.reservationFeeAmount) : '0')
      })
      .catch(() => showToast('Failed to load payment settings', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    const fee = parseFloat(feeAmount)
    if (enabled && (isNaN(fee) || fee < 0)) {
      setFeeError('Enter a valid reservation fee (0 or more)')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymongoEnabled: enabled, reservationFeeAmount: isNaN(fee) ? 0 : fee }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error ?? 'Failed to save', 'error')
        return
      }
      showToast('Payment settings saved', 'success')
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
              Enable PayMongo Online Payments
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Allow patients to pay reservation fees and balances online via GCash, Maya, or card.
            </Typography>
          </Box>
        }
        sx={{ alignItems: 'flex-start', ml: 0, mb: 2.5 }}
      />

      {enabled && (
        <>
          <Alert severity='info' sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.82rem' }}>
            Make sure <strong>PAYMONGO_SECRET_KEY</strong>, <strong>PAYMONGO_PUBLIC_KEY</strong>, and <strong>PAYMONGO_WEBHOOK_SECRET</strong> are set in your environment variables.
          </Alert>

          <Input
            id='reservation-fee'
            label='Reservation Fee Amount (₱)'
            type='number'
            inputProps={{ min: 0, step: '0.01' }}
            value={feeAmount}
            onChange={(e) => { setFeeAmount(e.target.value); setFeeError('') }}
            error={!!feeError}
            helperText={feeError || 'Charged upfront when a patient books. Set to 0 to skip the fee.'}
            placeholder='e.g. 500'
            sx={{ mb: 2.5 }}
          />
        </>
      )}

      <Button variant='contained' onClick={handleSave} loading={saving} disabled={loading}>
        Save Payment Settings
      </Button>
    </Box>
  )
}
