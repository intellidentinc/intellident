'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import OutlinedInput from '@mui/material/OutlinedInput'
import FormHelperText from '@mui/material/FormHelperText'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'

const DAYS = [
  { key: 'MON', label: 'Mon' },
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' }
]

export default function ClinicSchedule({ clinicId }) {
  const { showToast } = useToast()

  const [workingDays, setWorkingDays] = useState([])
  const [openTime, setOpenTime] = useState('08:00')
  const [closeTime, setCloseTime] = useState('17:00')
  const [timeError, setTimeError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/clinics/${clinicId}/schedule`)
      .then((r) => r.json())
      .then((data) => {
        setWorkingDays(data.workingDays ?? [])
        setOpenTime(data.openTime ?? '08:00')
        setCloseTime(data.closeTime ?? '17:00')
      })
      .catch(() => showToast('Failed to load schedule', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDay(day) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function handleOpenTime(e) {
    setOpenTime(e.target.value)
    setTimeError('')
  }

  function handleCloseTime(e) {
    setCloseTime(e.target.value)
    setTimeError('')
  }

  async function handleSave() {
    if (openTime >= closeTime) {
      setTimeError('Opening time must be before closing time')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workingDays, openTime, closeTime })
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error ?? 'Failed to save', 'error')
        return
      }
      showToast('Operating hours saved', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Typography variant='body2' color='text.secondary'>
        Loading...
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Working days */}
      <Box>
        <Typography variant='body2' fontWeight={500} color='text.primary' sx={{ mb: 1.5 }}>
          Working Days
        </Typography>
        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
          {DAYS.map(({ key, label }) => {
            const active = workingDays.includes(key)
            return (
              <Box
                key={key}
                onClick={() => toggleDay(key)}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: active ? '#2563eb' : 'divider',
                  bgcolor: active ? '#eff6ff' : 'transparent',
                  color: active ? '#2563eb' : 'text.secondary',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s'
                }}
              >
                {label}
              </Box>
            )
          })}
        </Stack>
      </Box>

      {/* Hours */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography
            component='label'
            htmlFor='open-time'
            variant='body2'
            fontWeight={500}
            color='text.primary'
            display='block'
            sx={{ mb: 0.75 }}
          >
            Opening Time
          </Typography>
          <OutlinedInput
            id='open-time'
            type='time'
            value={openTime}
            onChange={handleOpenTime}
            fullWidth
            inputProps={{ step: 300 }}
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography
            component='label'
            htmlFor='close-time'
            variant='body2'
            fontWeight={500}
            color='text.primary'
            display='block'
            sx={{ mb: 0.75 }}
          >
            Closing Time
          </Typography>
          <OutlinedInput
            id='close-time'
            type='time'
            value={closeTime}
            onChange={handleCloseTime}
            fullWidth
            inputProps={{ step: 300 }}
          />
        </Box>
      </Stack>

      {timeError && (
        <FormHelperText error sx={{ mx: 0, mt: -2 }}>
          {timeError}
        </FormHelperText>
      )}

      <Box>
        <Button variant='contained' loading={saving} onClick={handleSave}>
          Save Hours
        </Button>
      </Box>
    </Box>
  )
}
