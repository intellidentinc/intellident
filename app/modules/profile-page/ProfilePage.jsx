'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useToast } from '@/app/providers/ToastProvider'
import Input from '@/components/commons/Input'
import Button from '@/components/commons/Button'

function validate(form) {
  const errs = {}
  if (!form.firstName.trim()) errs.firstName = 'First name is required'
  if (!form.lastName.trim()) errs.lastName = 'Last name is required'
  if (!form.email.trim()) errs.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format'
  return errs
}

export default function ProfilePage() {
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        setForm({
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? ''
        })
      })
      .catch(() => showToast('Failed to load profile', 'error'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
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
      <header className='flex h-14 items-center gap-3 border-b bg-white px-4'>
        <SidebarTrigger />
        <div className='h-5 w-px bg-gray-200' />
        <span className='font-semibold text-slate-700'>My Profile</span>
      </header>

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
              id='last-name'
              label='Last Name'
              value={form.lastName}
              onChange={handleChange('lastName')}
              placeholder='e.g. dela Cruz'
              error={!!errors.lastName}
              helperText={errors.lastName}
              required
            />
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
