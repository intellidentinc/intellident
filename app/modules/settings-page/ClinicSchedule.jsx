'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import OutlinedInput from '@mui/material/OutlinedInput'
import FormHelperText from '@mui/material/FormHelperText'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { Trash2, CheckCircle2 } from 'lucide-react'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
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

  const [presets, setPresets] = useState([])
  const [appliedPresetId, setAppliedPresetId] = useState(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!clinicId) return
    Promise.all([
      fetch(`/api/clinics/${clinicId}/schedule`).then((r) => r.json()),
      fetch(`/api/clinics/${clinicId}/schedule/presets`).then((r) => r.json())
    ])
      .then(([schedule, presetsData]) => {
        setWorkingDays(schedule.workingDays ?? [])
        setOpenTime(schedule.openTime ?? '08:00')
        setCloseTime(schedule.closeTime ?? '17:00')
        if (Array.isArray(presetsData)) setPresets(presetsData)
      })
      .catch(() => showToast('Failed to load schedule', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDay(day) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
    setAppliedPresetId(null)
  }

  function handleApplyPreset(presetId) {
    if (!presetId) return
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    setWorkingDays(preset.workingDays)
    setOpenTime(preset.openTime)
    setCloseTime(preset.closeTime)
    setTimeError('')
    setAppliedPresetId(preset.id)
    showToast(`Preset "${preset.name}" applied`, 'info')
  }

  async function handleSavePreset() {
    if (!presetName.trim()) return
    setSavingPreset(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/schedule/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName, workingDays, openTime, closeTime })
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error ?? 'Failed to save preset', 'error')
        return
      }
      setPresets((prev) => [...prev, data])
      showToast(`Preset "${data.name}" saved`, 'success')
      setSaveModalOpen(false)
      setPresetName('')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSavingPreset(false)
    }
  }

  async function handleDeletePreset(presetId) {
    setDeletingId(presetId)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/schedule/presets/${presetId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        showToast('Failed to delete preset', 'error')
        return
      }
      setPresets((prev) => prev.filter((p) => p.id !== presetId))
      showToast('Preset deleted', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setDeletingId(null)
    }
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
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Presets */}
        <Box>
          <Typography variant='body2' fontWeight={500} color='text.primary' sx={{ mb: 1.5 }}>
            Presets
          </Typography>
          {presets.length === 0 ? (
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
              No presets saved yet.
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ mb: 1 }}>
              {presets.map((preset) => (
                <Box
                  key={preset.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1,
                    border: '1px solid',
                    borderColor: appliedPresetId === preset.id ? '#2563eb' : 'divider',
                    borderRadius: 2,
                    bgcolor: appliedPresetId === preset.id ? '#eff6ff' : 'background.paper',
                    transition: 'all 0.15s'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {appliedPresetId === preset.id && (
                      <CheckCircle2 size={16} color='#2563eb' />
                    )}
                    <Box>
                      <Typography variant='body2' fontWeight={600} color={appliedPresetId === preset.id ? '#2563eb' : 'text.primary'}>
                        {preset.name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {preset.workingDays.join(', ')} · {preset.openTime}–{preset.closeTime}
                      </Typography>
                    </Box>
                  </Box>
                  <Stack direction='row' spacing={0.5} alignItems='center'>
                    <Button
                      variant='outlined'
                      size='small'
                      onClick={() => handleApplyPreset(preset.id)}
                      sx={{ fontSize: '0.75rem', py: 0.5, px: 1.5 }}
                    >
                      Apply
                    </Button>
                    <Tooltip title='Delete preset'>
                      <IconButton
                        size='small'
                        onClick={() => handleDeletePreset(preset.id)}
                        disabled={deletingId === preset.id}
                        sx={{ color: 'error.main' }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>

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
              onChange={(e) => { setOpenTime(e.target.value); setTimeError(''); setAppliedPresetId(null) }}
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
              onChange={(e) => { setCloseTime(e.target.value); setTimeError(''); setAppliedPresetId(null) }}
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

        <Stack direction='row' spacing={1.5}>
          <Button variant='contained' loading={saving} onClick={handleSave}>
            Save Hours
          </Button>
          <Button variant='outlined' onClick={() => setSaveModalOpen(true)}>
            Save as Preset
          </Button>
        </Stack>
      </Box>

      {/* Save Preset Modal */}
      <Dialog open={saveModalOpen} onClose={() => { setSaveModalOpen(false); setPresetName('') }} maxWidth='xs' fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Save as Preset</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Saves the current days and hours as a reusable preset.
          </Typography>
          <Input
            id='preset-name'
            label='Preset Name'
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder='e.g. Regular Hours, Half Day'
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant='outlined' onClick={() => { setSaveModalOpen(false); setPresetName('') }}>
            Cancel
          </Button>
          <Button
            variant='contained'
            loading={savingPreset}
            disabled={!presetName.trim()}
            onClick={handleSavePreset}
          >
            Save Preset
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
