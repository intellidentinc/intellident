'use client'

import { useState, useEffect, useRef } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { RotateCcw, CheckCircle2, FileJson, Upload } from 'lucide-react'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'

// Entities shown in the restore summary, in import order.
const SUMMARY_ROWS = [
  ['users', 'User accounts'],
  ['dentists', 'Dentist profiles'],
  ['receptionists', 'Receptionist profiles'],
  ['patients', 'Patients'],
  ['services', 'Services'],
  ['appointments', 'Appointments'],
  ['billing', 'Billing records'],
  ['payments', 'Payments'],
  ['closures', 'Closure dates'],
]

export default function RestoreModal({ open, clinic, onClose, onStepUpRequired }) {
  const [step, setStep] = useState('reason')
  const [reason, setReason] = useState('')
  const [snapshotDescription, setSnapshotDescription] = useState('')
  const [pendingToken, setPendingToken] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [confirmationToken, setConfirmationToken] = useState('')
  const [authorizedAt, setAuthorizedAt] = useState('')
  const [summary, setSummary] = useState(null)
  const [file, setFile] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setStep('reason')
      setReason('')
      setSnapshotDescription('')
      setPendingToken('')
      setOtpCode('')
      setConfirmationToken('')
      setAuthorizedAt('')
      setSummary(null)
      setFile(null)
      setFileInfo(null)
      setError('')
    }
  }, [open])

  async function handleFileChange(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    setError('')
    setFile(null)
    setFileInfo(null)
    try {
      const parsed = JSON.parse(await picked.text())
      if (!parsed?._meta) {
        setError('That file is not a valid IntelliDent backup (missing metadata).')
        return
      }
      if (parsed._meta.clinicId !== clinic?.id) {
        setError('This backup belongs to a different clinic and cannot be restored here.')
        return
      }
      setFile(picked)
      setFileInfo({
        generatedAt: parsed._meta.generatedAt,
        schemaVersion: parsed._meta.schemaVersion,
        users: parsed.users?.length ?? 0,
        patients: parsed.patients?.length ?? 0,
        appointments: parsed.appointments?.length ?? 0,
        billing: parsed.billing?.length ?? 0,
      })
    } catch {
      setError('Could not read that file. Make sure it is a backup .json file.')
    }
  }

  async function handleRequestOtp() {
    if (!reason.trim()) { setError('Restore reason is required'); return }
    if (!file) { setError('Select a backup file to restore'); return }
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
    if (!file) { setError('Backup file missing — start over'); return }
    setError('')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('pendingToken', pendingToken)
      fd.append('code', otpCode)
      fd.append('reason', reason)
      fd.append('snapshotDescription', snapshotDescription)

      const res = await fetch(`/api/super/clinics/${clinic.id}/restore/confirm`, { method: 'POST', body: fd })
      const data = await res.json()
      if (res.status === 403 && data.requiresStepUp) { onStepUpRequired(); return }
      if (!res.ok) { setError(data.error || 'Restore failed'); return }
      setConfirmationToken(data.confirmationToken)
      setAuthorizedAt(data.authorizedAt)
      setSummary(data.summary)
      setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isDone = step === 'done'
  const skippedTotal = summary
    ? SUMMARY_ROWS.reduce((n, [k]) => n + (summary[k]?.skipped ?? 0), 0)
    : 0

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
            {isDone ? 'Restore Complete' : 'Restore Clinic Data'}
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
                <strong>High-privilege operation.</strong> This merges the selected backup into the live
                clinic database — existing records are updated, missing ones are re-created. The backup
                file contains hashed credentials and encrypted key material; handle it securely.
                A 6-digit code will be emailed to you before the restore runs.
              </Typography>
            </Box>

            <Box>
              <Typography variant='caption' fontWeight={700} color='text.secondary' sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Backup file
              </Typography>
              <input
                ref={fileInputRef}
                type='file'
                accept='.json,application/json'
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {!fileInfo ? (
                <Box sx={{ mt: 0.75 }}>
                  <Button variant='outlined' onClick={() => fileInputRef.current?.click()} startIcon={<Upload size={16} />}>
                    Select backup .json
                  </Button>
                </Box>
              ) : (
                <Box sx={{
                  mt: 0.75, display: 'flex', alignItems: 'center', gap: 1.5,
                  bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, px: 2, py: 1.25,
                }}>
                  <FileJson size={20} color='#2563eb' style={{ flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant='body2' fontWeight={600} color='text.primary' noWrap>
                      {fileInfo.users} users · {fileInfo.patients} patients · {fileInfo.appointments} appointments · {fileInfo.billing} bills
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      v{fileInfo.schemaVersion} · generated {fileInfo.generatedAt ? new Date(fileInfo.generatedAt).toLocaleString() : 'unknown'}
                    </Typography>
                  </Box>
                  <Button variant='text' size='small' onClick={() => fileInputRef.current?.click()}>Change</Button>
                </Box>
              )}
            </Box>

            <Input
              id='restore-reason'
              label='Reason for restore'
              required
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError('') }}
              placeholder='e.g. Production data loss — incident #XYZ'
            />
            <Input
              id='restore-snapshot'
              label='Snapshot / source reference (optional)'
              value={snapshotDescription}
              onChange={(e) => setSnapshotDescription(e.target.value)}
              placeholder='e.g. nightly backup 2026-06-07'
            />
            {error && (
              <Typography variant='body2' color='#b91c1c'>{error}</Typography>
            )}
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button variant='outlined' onClick={onClose} disabled={loading}>Cancel</Button>
            <Button
              variant='contained'
              loading={loading}
              disabled={!file || !reason.trim()}
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
                A 6-digit code has been sent to your registered email. Enter it below to run the restore.
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
              Run Restore
            </Button>
          </DialogActions>
        </>
      )}

      {step === 'done' && (
        <>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '20px !important' }}>
            <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, px: 2, py: 1.5 }}>
              <Typography variant='body2' color='#15803d' lineHeight={1.7}>
                Data restored from the backup and recorded in the audit log.
                {skippedTotal > 0 && ' Some rows were skipped (already superseded, or referencing records that no longer exist).'}
              </Typography>
            </Box>

            {summary && (
              <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', bgcolor: '#f8fafc', px: 2, py: 1, gap: 2 }}>
                  <Typography variant='caption' fontWeight={700} color='text.secondary'>ENTITY</Typography>
                  <Typography variant='caption' fontWeight={700} color='text.secondary'>NEW</Typography>
                  <Typography variant='caption' fontWeight={700} color='text.secondary'>UPDATED</Typography>
                  <Typography variant='caption' fontWeight={700} color='text.secondary'>SKIPPED</Typography>
                </Box>
                {SUMMARY_ROWS.filter(([k]) => summary[k]).map(([k, label]) => (
                  <Box key={k} sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', px: 2, py: 0.75, gap: 2, borderTop: '1px solid #f1f5f9' }}>
                    <Typography variant='body2' color='text.primary'>{label}</Typography>
                    <Typography variant='body2' color='text.secondary' textAlign='right'>{summary[k].created ?? 0}</Typography>
                    <Typography variant='body2' color='text.secondary' textAlign='right'>{summary[k].updated ?? 0}</Typography>
                    <Typography variant='body2' color={summary[k].skipped ? '#b45309' : 'text.secondary'} textAlign='right'>{summary[k].skipped ?? 0}</Typography>
                  </Box>
                ))}
              </Box>
            )}

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
                {authorizedAt && `Completed at ${new Date(authorizedAt).toLocaleString()}.`}
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
