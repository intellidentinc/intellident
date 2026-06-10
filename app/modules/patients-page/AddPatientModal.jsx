'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'
import { PersonAddOutlined } from '@mui/icons-material'
import {
  generateSalt,
  generateMasterKey,
  deriveKEK,
  wrapMasterKey,
  toBase64,
  generateTempPassword,
} from '@/lib/crypto'

function normalizeName(value) {
  return value
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

const EMPTY = { firstName: '', lastName: '', email: '', phone: '' }
const EMPTY_ERRORS = { firstName: '', lastName: '', email: '', phone: '' }

export default function AddPatientModal({ open, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState(EMPTY_ERRORS)
  const [loading, setLoading] = useState(false)

  function handleChange(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  function validate() {
    const next = { ...EMPTY_ERRORS }
    let valid = true

    if (!form.firstName.trim()) {
      next.firstName = 'First name is required'
      valid = false
    }
    if (!form.lastName.trim()) {
      next.lastName = 'Last name is required'
      valid = false
    }
    if (!form.email.trim()) {
      next.email = 'Email is required'
      valid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Enter a valid email address'
      valid = false
    }
    if (!form.phone.trim()) {
      next.phone = 'Mobile number is required'
      valid = false
    } else {
      const digits = form.phone.trim().replace(/\s/g, '')
      if (!/^\+639\d{9}$/.test(digits)) {
        next.phone = 'Enter a valid PH mobile number (e.g. +639XXXXXXXXX)'
        valid = false
      }
    }

    setErrors(next)
    return valid
  }

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)
    try {
      // Generate a unique temporary password and wrap the master key with a KEK
      // derived from it. The server uses this same value as the login password,
      // so the key-encryption password is high-entropy and per-patient.
      const tempPassword = generateTempPassword()
      const salt = generateSalt()
      const kek = await deriveKEK(tempPassword, salt)
      const masterKey = await generateMasterKey()
      const wrappedKey = await wrapMasterKey(masterKey, kek)
      const keySalt = toBase64(salt)

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: normalizeName(form.firstName.trim()),
          lastName: normalizeName(form.lastName.trim()),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          tempPassword,
          wrappedKey,
          keySalt,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 400 && data.error?.toLowerCase().includes('email')) {
          setErrors((prev) => ({ ...prev, email: data.error }))
        } else {
          showToast(data.error || 'Failed to register patient', 'error')
        }
        return
      }

      showToast('Patient registered successfully', 'success')
      setForm(EMPTY)
      setErrors(EMPTY_ERRORS)
      onSuccess()
    } catch {
      showToast('Failed to register patient', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setForm(EMPTY)
    setErrors(EMPTY_ERRORS)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='xs'
      fullWidth
      slotProps={{
        paper: {
          sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: 0.25,
          }}
        >
          <PersonAddOutlined sx={{ fontSize: 20, color: '#2563eb' }} />
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            Register Walk-in Patient
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            A secure temporary password will be emailed to the patient.
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Input
            id='firstName'
            label='First Name'
            value={form.firstName}
            onChange={handleChange('firstName')}
            placeholder='Juan'
            error={!!errors.firstName}
            helperText={errors.firstName}
            required
          />
          <Input
            id='lastName'
            label='Last Name'
            value={form.lastName}
            onChange={handleChange('lastName')}
            placeholder='Dela Cruz'
            error={!!errors.lastName}
            helperText={errors.lastName}
            required
          />
        </Box>

        <Input
          id='email'
          label='Email Address'
          type='email'
          value={form.email}
          onChange={handleChange('email')}
          placeholder='juan@example.com'
          error={!!errors.email}
          helperText={errors.email}
          required
        />

        <Input
          id='phone'
          label='Mobile Number'
          value={form.phone}
          onChange={handleChange('phone')}
          placeholder='+639XXXXXXXXX'
          error={!!errors.phone}
          helperText={errors.phone || 'Include country code (+63)'}
          startAdornment={
            <InputAdornment position='start'>
              <Typography variant='body2' color='text.secondary'>🇵🇭</Typography>
            </InputAdornment>
          }
          required
        />
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant='contained' onClick={handleSubmit} loading={loading}>
          Register patient
        </Button>
      </Box>
    </Dialog>
  )
}
