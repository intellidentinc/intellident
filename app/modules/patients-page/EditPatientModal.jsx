'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'
import { EditOutlined } from '@mui/icons-material'

const EMPTY_ERRORS = { firstName: '', lastName: '', email: '', phone: '' }

export default function EditPatientModal({ open, patient, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [errors, setErrors] = useState(EMPTY_ERRORS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (patient) {
      setForm({
        firstName: patient.firstName ?? '',
        lastName: patient.lastName ?? '',
        email: patient.email ?? '',
        phone: patient.phone ?? '',
      })
      setErrors(EMPTY_ERRORS)
    }
  }, [patient])

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
    if (form.phone.trim()) {
      const digits = form.phone.trim().replace(/\s/g, '')
      if (!/^\+639\d{9}$/.test(digits)) {
        next.phone = 'Enter a valid PH mobile number (e.g. +639XXXXXXXXX)'
        valid = false
      }
    }

    setErrors(next)
    return valid
  }

  async function handleSave() {
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 400 && data.error?.toLowerCase().includes('email')) {
          setErrors((prev) => ({ ...prev, email: data.error }))
        } else {
          showToast(data.error || 'Failed to update patient', 'error')
        }
        return
      }

      showToast('Patient updated', 'success')
      onSuccess()
    } catch {
      showToast('Failed to update patient', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
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
          <EditOutlined sx={{ fontSize: 20, color: '#2563eb' }} />
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            Edit Patient
          </Typography>
          {patient && (
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              {patient.firstName} {patient.lastName}
            </Typography>
          )}
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Input
            id='edit-firstName'
            label='First Name'
            value={form.firstName}
            onChange={handleChange('firstName')}
            placeholder='Juan'
            error={!!errors.firstName}
            helperText={errors.firstName}
            required
          />
          <Input
            id='edit-lastName'
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
          id='edit-email'
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
          id='edit-phone'
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
        />
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant='contained' onClick={handleSave} loading={loading}>
          Save changes
        </Button>
      </Box>
    </Dialog>
  )
}
