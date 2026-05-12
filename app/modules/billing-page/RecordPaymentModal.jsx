'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { Banknote } from 'lucide-react'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'

export default function RecordPaymentModal({ open, onClose, billing, onSuccess }) {
  const { showToast } = useToast()
  const [amount, setAmount]   = useState('')
  const [notes, setNotes]     = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  function handleClose() {
    if (loading) return
    setAmount('')
    setNotes('')
    setErrors({})
    onClose()
  }

  async function handleSubmit() {
    const errs = {}
    const parsed = parseFloat(amount)
    if (!amount || isNaN(parsed) || parsed <= 0) errs.amount = 'Enter a valid amount'
    if (parsed > (billing?.balance ?? 0) + 0.001) errs.amount = `Cannot exceed outstanding balance of ₱${Number(billing?.balance ?? 0).toFixed(2)}`
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/billing/${billing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsed, notes: notes || undefined, method: 'CASH' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to record payment')
      }
      showToast('Payment recorded successfully', 'success')
      onSuccess()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const balance = Number(billing?.balance ?? 0)

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
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
          <Banknote size={18} color='#2563eb' />
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>Record Cash Payment</Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            Outstanding balance: <strong>₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Input
          id='payment-amount'
          label='Amount Received (₱)'
          required
          type='number'
          inputProps={{ min: 0.01, max: balance, step: '0.01' }}
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: undefined })) }}
          error={!!errors.amount}
          helperText={errors.amount}
          placeholder={`0.00 – ${balance.toFixed(2)}`}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography component='label' htmlFor='payment-notes' variant='body2' fontWeight={500} color='text.primary'>
            Notes <Typography component='span' variant='body2' color='text.secondary'>(optional)</Typography>
          </Typography>
          <Box
            component='textarea'
            id='payment-notes'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. Paid in full, gave exact change'
            rows={3}
            sx={{
              width: '100%',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              p: 1.25,
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              color: '#334155',
              outline: 'none',
              '&:focus': { borderColor: '#2563eb' },
              boxSizing: 'border-box',
            }}
          />
        </Box>
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant='contained' onClick={handleSubmit} loading={loading}>Record Payment</Button>
      </Box>
    </Dialog>
  )
}
