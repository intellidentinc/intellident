'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import Input from '@/components/commons/Input'
import Button from '@/components/commons/Button'
import AddressSelector, { EMPTY_ADDRESS } from '@/components/commons/AddressSelector'
import DataRightsDialog from './DataRightsDialog'

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
]

function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const today = new Date()
  const dob = new Date(dateOfBirth)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age >= 0 ? age : null
}

function validate(form) {
  const errs = {}
  if (!form.firstName.trim()) errs.firstName = 'First name is required'
  if (!form.lastName.trim()) errs.lastName = 'Last name is required'
  if (!form.email.trim()) errs.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format'
  if (form.phone.trim() && !/^\+63\d{10}$/.test(form.phone.trim())) {
    errs.phone = 'Mobile must be +63XXXXXXXXXX (10 digits after +63)'
  }
  return errs
}

export default function ProfilePage() {
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ firstName: '', middleInitial: '', lastName: '', email: '', phone: '+63', address: { ...EMPTY_ADDRESS }, dateOfBirth: '', gender: '' })
  const [errors, setErrors] = useState({})
  const [username, setUsername] = useState(null)
  const [role, setRole] = useState(null)
  const [dataRightsOpen, setDataRightsOpen] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        setForm({
          firstName: data.firstName ?? '',
          middleInitial: data.middleInitial ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '+63',
          address: (data.address && typeof data.address === 'object')
            ? { ...EMPTY_ADDRESS, ...data.address }
            : { ...EMPTY_ADDRESS, street: typeof data.address === 'string' ? data.address : '' },
          dateOfBirth: data.dateOfBirth ?? '',
          gender: data.gender ?? ''
        })
        if (data.username) setUsername(data.username)
        if (data.role !== undefined) setRole(data.role)
      })
      .catch(() => showToast('Failed to load profile', 'error'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  function handleChange(field) {
    return (e) => {
      let value = e.target.value
      // Prevent removing the +63 prefix on phone
      if (field === 'phone' && !value.startsWith('+63')) value = '+63' + value.replace(/^\+63/, '')
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  async function handleSave() {
    const errs = validate(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setErrors((prev) => ({ ...prev, email: data.error }))
        } else {
          showToast(data.error ?? 'Failed to save', 'error')
        }
        return
      }
      showToast('Profile saved', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidebarInset>
      <PageHeader title='My Profile' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        <Typography variant='h5' fontWeight={700} color='text.primary' gutterBottom>
          My Profile
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          Update your personal information.
        </Typography>

        <Divider sx={{ mb: 4 }} />

        {loading ? (
          <Typography variant='body2' color='text.secondary'>
            Loading...
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {username && (
              <Input
                id='username'
                label='Username'
                value={username}
                disabled
                helperText='System-generated — not editable'
              />
            )}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Input
                id='first-name'
                label='First Name'
                value={form.firstName}
                onChange={handleChange('firstName')}
                placeholder='e.g. Juan'
                error={!!errors.firstName}
                helperText={errors.firstName}
                required
              />
              <Input
                id='middle-name'
                label='Middle Name'
                value={form.middleInitial}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, middleInitial: e.target.value }))
                  setErrors((prev) => ({ ...prev, middleInitial: '' }))
                }}
                placeholder='e.g. Santos'
              />
              <Input
                id='last-name'
                label='Last Name'
                value={form.lastName}
                onChange={handleChange('lastName')}
                placeholder='e.g. dela Cruz'
                error={!!errors.lastName}
                helperText={errors.lastName}
                required
              />
            </Box>
            <Input
              id='email'
              label='Email'
              type='email'
              value={form.email}
              onChange={handleChange('email')}
              placeholder='you@example.com'
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
              helperText={errors.phone}
            />
            <AddressSelector
              value={form.address}
              onChange={(updated) => setForm((prev) => ({ ...prev, address: updated }))}
            />
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              <Box sx={{ flex: 1 }}>
                <Input
                  id='date-of-birth'
                  label='Birthdate'
                  type='date'
                  value={form.dateOfBirth}
                  onChange={handleChange('dateOfBirth')}
                  slotProps={{ htmlInput: { max: new Date().toISOString().split('T')[0] } }}
                />
              </Box>
              {computeAge(form.dateOfBirth) !== null && (
                <Box sx={{ flexShrink: 0, mb: '2px' }}>
                  <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: '4px', fontWeight: 500 }}>
                    Age
                  </Typography>
                  <Box sx={{
                    height: 40, px: 2, display: 'flex', alignItems: 'center',
                    border: '1px solid', borderColor: 'divider', borderRadius: 1,
                    bgcolor: 'action.hover', minWidth: 72
                  }}>
                    <Typography variant='body2' color='text.primary' fontWeight={600}>
                      {computeAge(form.dateOfBirth)} yrs
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
            <Box>
              <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: '4px', fontWeight: 500 }}>
                Gender
              </Typography>
              <TextField
                select
                fullWidth
                size='small'
                value={form.gender}
                onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                slotProps={{ select: { displayEmpty: true } }}
              >
                <MenuItem value=''>
                  <em style={{ color: '#94a3b8' }}>Select gender</em>
                </MenuItem>
                {GENDER_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ pt: 1 }}>
              <Button variant='contained' loading={saving} onClick={handleSave}>
                Save Changes
              </Button>
            </Box>

            {role === 4 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Box>
                  <Typography variant='subtitle1' fontWeight={600} color='text.primary' gutterBottom>
                    Data Rights
                  </Typography>
                  <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                    Under the Philippine Data Privacy Act, you may request access to, correction or deletion of, or transfer of your personal data.
                  </Typography>
                  <Button variant='outlined' onClick={() => setDataRightsOpen(true)}>
                    Submit a Data Rights Request
                  </Button>
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>

      <DataRightsDialog open={dataRightsOpen} onClose={() => setDataRightsOpen(false)} />
    </SidebarInset>
  )
}
