'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import MuiSelect from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import InputAdornment from '@mui/material/InputAdornment'
import { MedicalServicesOutlined } from '@mui/icons-material'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'

const EMPTY_FORM = {
  name: '',
  duration: '',
  price: '',
  bufferTime: '0',
  dentistIds: [],
}

function validate(form) {
  const errors = {}
  if (!form.name) errors.name = 'Service name is required'
  const dur = parseInt(form.duration, 10)
  if (!form.duration) errors.duration = 'Duration is required'
  else if (isNaN(dur) || dur < 15 || dur > 240) errors.duration = 'Must be between 15 and 240'
  const buf = parseInt(form.bufferTime, 10)
  if (isNaN(buf) || buf < 0 || buf > 30) errors.bufferTime = 'Must be between 0 and 30'
  return errors
}

export default function ServiceFormModal({ open, service, dentists, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const isEdit = !!service

  useEffect(() => {
    if (open) {
      if (service) {
        setForm({
          name: service.name ?? '',
          duration: String(service.duration ?? ''),
          price: service.price !== null && service.price !== undefined ? String(service.price) : '',
          bufferTime: String(service.bufferTime ?? 0),
          dentistIds: service.dentists?.map((d) => d.id) ?? [],
        })
      } else {
        setForm(EMPTY_FORM)
      }
      setErrors({})
    }
  }, [open, service])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit() {
    const errs = validate(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setLoading(true)
    try {
      const body = {
        name: form.name,
        duration: parseInt(form.duration, 10),
        price: form.price !== '' ? parseFloat(form.price) : null,
        bufferTime: parseInt(form.bufferTime, 10),
        dentistIds: form.dentistIds,
      }

      const res = await fetch(
        isEdit ? `/api/services/${service.id}` : '/api/services',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed')
      }

      showToast(isEdit ? 'Service updated' : 'Service created', 'success')
      onSuccess()
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } }
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
            mt: 0.25
          }}
        >
          <MedicalServicesOutlined sx={{ fontSize: 20, color: '#2563eb' }} />
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            {isEdit ? 'Edit Service' : 'Add Service'}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            {isEdit ? 'Update the service details below.' : 'Fill in the details to add a new service.'}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Service Name */}
        <Input
          id='service-name'
          label='Service Name'
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder='e.g. Dental Filling'
          error={!!errors.name}
          helperText={errors.name}
        />

        {/* Duration + Buffer Time */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Input
            id='duration'
            label='Duration (minutes)'
            required
            type='number'
            inputProps={{ min: 15, max: 240 }}
            value={form.duration}
            onChange={(e) => set('duration', e.target.value)}
            error={!!errors.duration}
            helperText={errors.duration ?? '15–240 min'}
            placeholder='e.g. 30'
          />
          <Input
            id='buffer-time'
            label='Buffer Time (minutes)'
            type='number'
            inputProps={{ min: 0, max: 30 }}
            value={form.bufferTime}
            onChange={(e) => set('bufferTime', e.target.value)}
            error={!!errors.bufferTime}
            helperText={errors.bufferTime ?? '0–30 min'}
            placeholder='0'
          />
        </Box>

        {/* Default Price */}
        <Input
          id='price'
          label='Default Price'
          type='number'
          inputProps={{ min: 0, step: 0.01 }}
          value={form.price}
          onChange={(e) => set('price', e.target.value)}
          placeholder='Optional'
          startAdornment={form.price !== '' ? (
            <InputAdornment position='start'>₱</InputAdornment>
          ) : undefined}
        />

        {/* Assigned Dentists */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography
            component='label'
            variant='body2'
            fontWeight={500}
            sx={{ color: 'text.primary', userSelect: 'none' }}
          >
            Assigned Dentists
          </Typography>
          <MuiSelect
            multiple
            value={form.dentistIds}
            onChange={(e) => set('dentistIds', e.target.value)}
            input={<OutlinedInput size='small' />}
            renderValue={(selected) => {
              if (!selected.length) return <Typography variant='body2' color='text.disabled'>Select dentists</Typography>
              return selected
                .map((id) => {
                  const d = dentists.find((x) => x.id === id)
                  return d ? `${d.user.firstName} ${d.user.lastName}` : id
                })
                .join(', ')
            }}
            displayEmpty
            fullWidth
            size='small'
          >
            {dentists.length === 0 && (
              <MenuItem disabled>
                <Typography variant='body2' color='text.disabled'>No dentists available</Typography>
              </MenuItem>
            )}
            {dentists.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                <Checkbox
                  checked={form.dentistIds.includes(d.id)}
                  size='small'
                  sx={{ py: 0, color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }}
                />
                <ListItemText
                  primary={`${d.user.firstName} ${d.user.lastName}`}
                  secondary={d.specialty ?? undefined}
                />
              </MenuItem>
            ))}
          </MuiSelect>
        </Box>
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant='contained' onClick={handleSubmit} loading={loading}>
          {isEdit ? 'Save changes' : 'Add service'}
        </Button>
      </Box>
    </Dialog>
  )
}
