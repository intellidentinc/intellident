'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { RotateCcw, CheckCircle2 } from 'lucide-react'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'

export default function RestoreModal({ open, clinic, onClose, onStepUpRequired }) {
  const [step, setStep] = useState('reason')
  const [reason, setReason] = useState('')
  const [snapshotDescription, setSnapshotDescription] = useState('')
  const [pendingToken, setPendingToken] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [confirmationToken, setConfirmationToken] = useState('')
  const [authorizedAt, setAuthorizedAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setStep('reason')
      setReason('')
      setSnapshotDescription('')
      setPendingToken('')
      setOtpCode('')
      setConfirmationToken('')
      setAuthorizedAt('')
      setError('')
    }
  }, [open])

  async function handleRequestOtp() {
    if (!reason.trim()) { setError('Restore reason is required'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/super/clinics/${clinic.id}/restore/request-otp`, { method: 'POST' })
      const data = await res.json()
      if (res.status === 403 && data.requiresStepUp) { onStepUpRequired(); return }
      if (!res.ok) { setError(data.error || 'Failed to send code'); return }
      setPendingToken(data.pendingToken)
      setStep('otp')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!otpCode.trim()) { setError('Verification code is required'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/super/clinics/${clinic.id}/restore/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code: otpCode, reason, snapshotDescription }),
      })
      const data = await res.json()
      if (res.status === 403 && data.requiresStepUp) { onStepUpRequired(); return }
      if (!res.ok) { setError(data.error || 'Confirmation failed'); return }
      setConfirmationToken(data.confirmationToken)
      setAuthorizedAt(data.authorizedAt)
      setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isDone = step === 'done'

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth='sm'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 2, flexShrink: 0, mt: 0.25,
          bgcolor: isDone ? '#dcfce7' : '#fee2e2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isDone
            ? <CheckCircle2 size={20} color='#16a34a' />
            : <RotateCcw size={20} color='#dc2626' />}
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={700} color='text.primary'>
            {isDone ? 'Restore Authorized' : 'Authorize Data Restore'}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            {clinic?.name}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {step === 'reason' && (
        <>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '20px !important' }}>
            <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 2, px: 2, py: 1.5 }}>
              <Typography variant='body2' color='#b91c1c' lineHeight={1.7}>
                <strong>High-privilege operation.</strong> Restoring data will overwrite the current clinic database state.
                A 6-digit verification code will be emailed to your registered address before authorization is granted.
              </Typography>
            </Box>
            <Input
              id='restore-reason'
              label='Reason for restore'
              required
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError('') }}
              placeholder='e.g. Production data loss — incident #XYZ'
              error={!!error}
              helperText={error}
            />
            <Input
              id='restore-snapshot'
              label='Snapshot / Point-in-time reference (optional)'
              value={snapshotDescription}
              onChange={(e) => setSnapshotDescription(e.target.value)}
              placeholder='e.g. Neon PITR snapshot 2026-06-07T02:00:00Z'
            />
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button variant='outlined' onClick={onClose} disabled={loading}>Cancel</Button>
            <Button
              variant='contained'
              loading={loading}
              onClick={handleRequestOtp}
              sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
            >
              Send Verification Code
            </Button>
          </DialogActions>
        </>
      )}

      {step === 'otp' && (
        <>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '20px !important' }}>
            <Box sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2, px: 2, py: 1.5 }}>
              <Typography variant='body2' color='#1d4ed8' lineHeight={1.7}>
                A 6-digit code has been sent to your registered email. Enter it below to complete the authorization.
                The code expires in <strong>10 minutes</strong>.
              </Typography>
            </Box>
            <Input
              id='restore-otp'
              label='Verification code'
              required
              value={otpCode}
              onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
              placeholder='000000'
              error={!!error}
              helperText={error}
              autoFocus
              inputProps={{
                inputMode: 'numeric',
                maxLength: 6,
                style: { letterSpacing: '0.5em', fontSize: '1.4rem', textAlign: 'center' },
              }}
            />
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button variant='outlined' onClick={() => { setStep('reason'); setError(''); setOtpCode('') }} disabled={loading}>
              Back
            </Button>
            <Button
              variant='contained'
              loading={loading}
              onClick={handleConfirm}
              sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
            >
              Confirm Authorization
            </Button>
          </DialogActions>
        </>
      )}

      {step === 'done' && (
        <>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '20px !important' }}>
            <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, px: 2, py: 1.5 }}>
              <Typography variant='body2' color='#15803d' lineHeight={1.7}>
                Authorization recorded in the audit log. Use the confirmation token below as your audit reference
                when executing the restore in the Neon dashboard.
              </Typography>
            </Box>
            <Box>
              <Typography variant='caption' fontWeight={700} color='text.secondary' sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Confirmation Token
              </Typography>
              <Box sx={{
                mt: 0.75, bgcolor: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 2, px: 2, py: 1.5, fontFamily: 'monospace',
                fontSize: '0.9rem', color: '#1d4ed8', letterSpacing: '0.12em',
                wordBreak: 'break-all', userSelect: 'all',
              }}>
                {confirmationToken}
              </Box>
              <Typography variant='caption' color='text.secondary' sx={{ mt: 0.75, display: 'block' }}>
                Copy this token and include it in your incident ticket.{' '}
                {authorizedAt && `Authorized at ${new Date(authorizedAt).toLocaleString()}.`}
              </Typography>
            </Box>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button variant='contained' onClick={onClose}>Done</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
