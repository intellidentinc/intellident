'use client'

import { useState, useEffect, useRef } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@/components/commons/Button'
import { ShieldCheck } from 'lucide-react'

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

export default function OtpStepUpModal({ open, onClose, onSuccess, description }) {
  const [step, setStep]                 = useState('send')
  const [pendingToken, setPendingToken] = useState('')
  const [digits, setDigits]             = useState(Array(OTP_LENGTH).fill(''))
  const [error, setError]               = useState('')
  const [sending, setSending]           = useState(false)
  const [verifying, setVerifying]       = useState(false)
  const [cooldown, setCooldown]         = useState(0)
  const inputRefs                       = useRef([])
  const timerRef                        = useRef(null)

  useEffect(() => {
    if (!open) {
      setStep('send')
      setPendingToken('')
      setDigits(Array(OTP_LENGTH).fill(''))
      setError('')
      setSending(false)
      setVerifying(false)
      setCooldown(0)
      clearInterval(timerRef.current)
    }
  }, [open])

  useEffect(() => () => clearInterval(timerRef.current), [])

  // Auto-focus first digit box when entering verify step
  useEffect(() => {
    if (step === 'verify') {
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    }
  }, [step])

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function doSend() {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/step-up/send-otp', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send code. Please try again.')
        return false
      }
      setPendingToken(data.pendingToken)
      return true
    } catch {
      setError('Something went wrong. Please try again.')
      return false
    } finally {
      setSending(false)
    }
  }

  async function handleSend() {
    const ok = await doSend()
    if (ok) {
      setStep('verify')
      startCooldown()
    }
  }

  async function handleResend() {
    if (cooldown > 0) return
    setDigits(Array(OTP_LENGTH).fill(''))
    setError('')
    clearInterval(timerRef.current)
    const ok = await doSend()
    if (ok) startCooldown()
  }

  function handleDigitChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    setError('')
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1)
    inputRefs.current[focusIdx]?.focus()
  }

  async function handleVerify(e) {
    e.preventDefault()
    const code = digits.join('')
    if (code.length < OTP_LENGTH) {
      setError('Please enter the complete 6-digit code.')
      return
    }
    setVerifying(true)
    setError('')
    try {
      const res = await fetch('/api/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess()
      } else {
        setError(data.error ?? 'Verification failed. Please try again.')
        setDigits(Array(OTP_LENGTH).fill(''))
        setTimeout(() => inputRefs.current[0]?.focus(), 50)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const busy = sending || verifying

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth='xs'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      <DialogContent sx={{ px: 4, py: 4 }}>
        {/* Icon + heading */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box
              sx={{
                width: 56, height: 56, borderRadius: 3, bgcolor: '#dbeafe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ShieldCheck size={28} color='#2563eb' />
            </Box>
          </Box>
          <Typography variant='h6' fontWeight={700} color='primary'>
            {step === 'send' ? 'Verify your identity' : 'Check your email'}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
            {step === 'send'
              ? (description ?? 'This action requires identity verification to proceed.')
              : "We sent a 6-digit code to your email. Enter it below to continue."}
          </Typography>
        </Box>

        {step === 'send' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {error && (
              <Typography variant='body2' color='error.main' textAlign='center'>
                {error}
              </Typography>
            )}
            <Button variant='contained' size='large' loading={sending} fullWidth onClick={handleSend}>
              Send Code to My Email
            </Button>
            <Button variant='outlined' size='large' onClick={onClose} disabled={sending} fullWidth>
              Cancel
            </Button>
          </Box>
        ) : (
          <Box component='form' onSubmit={handleVerify} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Digit boxes */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }} onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <TextField
                  key={i}
                  inputRef={(el) => (inputRefs.current[i] = el)}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  inputProps={{ maxLength: 1, style: { textAlign: 'center', fontSize: 24, fontWeight: 700, padding: '12px 0' } }}
                  sx={{
                    width: 48,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&.Mui-focused fieldset': { borderColor: '#2563eb', borderWidth: 2 },
                    },
                  }}
                />
              ))}
            </Box>

            {error && (
              <Typography variant='body2' color='error.main' textAlign='center'>
                {error}
              </Typography>
            )}

            <Typography variant='caption' color='text.secondary' textAlign='center'>
              Code expires in 10 minutes. Check your spam folder if you don&apos;t see it.
            </Typography>

            <Button type='submit' variant='contained' size='large' loading={verifying} fullWidth>
              Verify
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              {cooldown > 0 ? (
                <Typography variant='caption' color='text.disabled'>
                  Resend code in {cooldown}s
                </Typography>
              ) : (
                <Typography
                  component='button'
                  type='button'
                  variant='caption'
                  onClick={handleResend}
                  disabled={sending}
                  sx={{
                    color: '#2563eb', cursor: 'pointer', background: 'none',
                    border: 'none', p: 0, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600,
                    '&:hover': { textDecoration: 'underline' },
                    '&:disabled': { color: 'text.disabled', cursor: 'default' },
                  }}
                >
                  {sending ? 'Sending…' : "Didn't receive a code? Resend"}
                </Typography>
              )}
            </Box>

            <Button variant='outlined' size='large' onClick={onClose} disabled={verifying} fullWidth>
              Cancel
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
