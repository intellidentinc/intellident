'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useToast } from '@/app/providers/ToastProvider'
import ClinicLogoUpload from './ClinicLogoUpload'
import ClinicProfileForm from './ClinicProfileForm'
import ClinicSchedule from './ClinicSchedule'
import ClinicClosures from './ClinicClosures'

function validate(form) {
  const errs = {}
  if (!form.name.trim()) errs.name = 'Clinic name is required'
  if (!form.address.trim()) errs.address = 'Address is required'
  if (!form.email.trim()) errs.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format'
  if (form.phone.trim() && !/^\+639\d{9}$/.test(form.phone.trim())) errs.phone = 'Mobile must be +639XXXXXXXXX (10 digits after +63)'
  return errs
}

export default function SettingsPage() {
  const { clinicId } = useParams()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [form, setForm] = useState({ name: '', address: '', email: '', phone: '', landline: '' })
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/clinics/${clinicId}/profile`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          name: data.name ?? '',
          address: data.address ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          landline: data.landline ?? ''
        })
        setLogoUrl(data.logoUrl ?? null)
      })
      .catch(() => showToast('Failed to load clinic profile', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

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
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error ?? 'Failed to save', 'error')
        return
      }
      showToast('Clinic profile saved', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleUploadStart(preview) {
    setLogoPreview(preview)
    setUploading(true)
  }

  function handleUploadDone(url) {
    setUploading(false)
    if (url) {
      setLogoUrl(url)
    } else {
      setLogoPreview(null)
    }
  }

  return (
    <SidebarInset>
      <header className='flex h-14 items-center gap-3 border-b bg-white px-4'>
        <SidebarTrigger />
        <div className='h-5 w-px bg-gray-200' />
        <span className='font-semibold text-slate-700'>Settings</span>
      </header>

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        <Typography variant='h5' fontWeight={700} color='text.primary' gutterBottom>
          Clinic Profile
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          Update your clinic details. These are displayed to patients and staff.
        </Typography>

        <Divider sx={{ mb: 4 }} />

        <ClinicLogoUpload
          clinicId={clinicId}
          logoUrl={logoUrl}
          logoPreview={logoPreview}
          uploading={uploading}
          onUploadStart={handleUploadStart}
          onUploadDone={handleUploadDone}
        />

        <Divider sx={{ my: 4 }} />

        <ClinicProfileForm
          form={form}
          errors={errors}
          saving={saving}
          loading={loading}
          onChange={handleChange}
          onSave={handleSave}
        />

        <Divider sx={{ my: 4 }} />

        <Typography variant='h6' fontWeight={700} color='text.primary' gutterBottom>
          Operating Hours
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          Set the days and hours your clinic is open.
        </Typography>

        <ClinicSchedule clinicId={clinicId} />

        <Divider sx={{ my: 4 }} />

        <Typography variant='h6' fontWeight={700} color='text.primary' gutterBottom>
          Clinic Closures
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          Add dates when the clinic will be closed (holidays, maintenance, etc).
        </Typography>

        <ClinicClosures clinicId={clinicId} />
      </Box>
    </SidebarInset>
  )
}
