'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import Select from '@/components/commons/Select'
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
import { ROLES } from '@/lib/roles'

const ROLE_OPTIONS = [
  { value: ROLES.DENTIST,      label: 'Dentist' },
  { value: ROLES.RECEPTIONIST, label: 'Receptionist' },
]

// Super admins may also create a clinic ADMIN (e.g. the first admin of a new clinic).
const ADMIN_ROLE_OPTION = { value: ROLES.ADMIN, label: 'Administrator' }

function normalizeName(value) {
  return value
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

const EMPTY = { firstName: '', middleInitial: '', lastName: '', email: '', phone: '', role: '' }
const EMPTY_ERRORS = { firstName: '', middleInitial: '', lastName: '', email: '', phone: '', role: '' }

export default function AddUserModal({ open, onClose, onSuccess, allowAdmin = false }) {
  const { showToast } = useToast()
  const roleOptions = allowAdmin ? [ADMIN_ROLE_OPTION, ...ROLE_OPTIONS] : ROLE_OPTIONS
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
    if (form.phone.trim()) {
      const digits = form.phone.trim().replace(/\s/g, '')
      if (!/^\+639\d{9}$/.test(digits)) {
        next.phone = 'Enter a valid PH mobile number (e.g. +639XXXXXXXXX)'
        valid = false
      }
    }
    if (!form.role) {
      next.role = 'Role is required'
      valid = false
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
      // so the key-encryption password is high-entropy and per-user.
      const tempPassword = generateTempPassword()
      const salt = generateSalt()
      const kek = await deriveKEK(tempPassword, salt)
      const masterKey = await generateMasterKey()
      const wrappedKey = await wrapMasterKey(masterKey, kek)
      const keySalt = toBase64(salt)

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: normalizeName(form.firstName.trim()),
          middleInitial: form.middleInitial.trim() || null,
          lastName: normalizeName(form.lastName.trim()),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          role: form.role,
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
          showToast(data.error || 'Failed to create user', 'error')
        }
        return
      }

      showToast('User created successfully', 'success')
      setForm(EMPTY)
      setErrors(EMPTY_ERRORS)
      onSuccess()
    } catch {
      showToast('Failed to create user', 'error')
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
      maxWidth='sm'
      fullWidth
      slotProps={{
        paper: {
          sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }
        }
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
            Add New User
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            A secure temporary password will be emailed to the user.
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, '& > *': { flex: 1, minWidth: 0 } }}>
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
            id='middleInitial'
            label='Middle Name'
            value={form.middleInitial}
            onChange={(e) => setForm((prev) => ({ ...prev, middleInitial: e.target.value }))}
            placeholder='Santos'
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
          helperText={errors.phone || 'Optional — include country code (+63)'}
          startAdornment={
            <InputAdornment position='start'>
              <Typography variant='body2' color='text.secondary'>🇵🇭</Typography>
            </InputAdornment>
          }
        />

        <Select
          id='role'
          label='Role'
          value={form.role}
          onChange={handleChange('role')}
          options={roleOptions}
          error={!!errors.role}
          helperText={errors.role}
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
          Create user
        </Button>
      </Box>
    </Dialog>
  )
}
