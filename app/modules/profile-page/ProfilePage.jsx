'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import Input from '@/components/commons/Input'
import Button from '@/components/commons/Button'

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
  const [form, setForm] = useState({ firstName: '', middleInitial: '', lastName: '', email: '', phone: '+63', address: '', dateOfBirth: '' })
  const [errors, setErrors] = useState({})

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
          address: data.address ?? '',
          dateOfBirth: data.dateOfBirth ?? ''
        })
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
              <Box sx={{ width: 100, flexShrink: 0 }}>
                <Input
                  id='middle-initial'
                  label='M.I.'
                  value={form.middleInitial}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 2).toUpperCase()
                    setForm((prev) => ({ ...prev, middleInitial: val }))
                    setErrors((prev) => ({ ...prev, middleInitial: '' }))
                  }}
                  placeholder='A.'
                  slotProps={{ htmlInput: { maxLength: 2 } }}
                />
              </Box>
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
            <Input
              id='address'
              label='Address'
              value={form.address}
              onChange={handleChange('address')}
              placeholder='e.g. 123 Rizal St, Manila'
            />
            <Input
              id='date-of-birth'
              label='Birthdate'
              type='date'
              value={form.dateOfBirth}
              onChange={handleChange('dateOfBirth')}
              slotProps={{ htmlInput: { max: new Date().toISOString().split('T')[0] } }}
            />
            <Box sx={{ pt: 1 }}>
              <Button variant='contained' loading={saving} onClick={handleSave}>
                Save Changes
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </SidebarInset>
  )
}
