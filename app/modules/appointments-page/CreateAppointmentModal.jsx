'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import MuiSelect from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import { CalendarDays } from 'lucide-react'
import dayjs from 'dayjs'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'

const EMPTY_FORM = {
  patient: null,
  serviceId: '',
  dentistId: '',
  date: null,
  time: null,
  notes: '',
  status: 'PENDING',
}

function FieldLabel({ children, required }) {
  return (
    <Typography
      component='label'
      variant='body2'
      fontWeight={500}
      sx={{ color: 'text.primary', userSelect: 'none', mb: 0.75, display: 'block' }}
    >
      {children}
      {required && <Typography component='span' sx={{ color: '#E05C6A', ml: 0.25 }}>*</Typography>}
    </Typography>
  )
}

export default function CreateAppointmentModal({ open, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // Dropdown data
  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [patientQuery, setPatientQuery] = useState('')
  const [services, setServices] = useState([])
  const [dentists, setDentists] = useState([])
  const [closures, setClosures] = useState([]) // ISO date strings
  const [schedule, setSchedule] = useState(null) // { workingDays, openTime, closeTime }
  const [conflict, setConflict] = useState(null) // { available, conflict }

  useEffect(() => {
    if (!open) return
    setForm(EMPTY_FORM)
    setErrors({})
    setConflict(null)
    setPatientQuery('')

    // Fetch services and clinic schedule
    fetch('/api/appointments/services').then(r => r.json()).then(d => setServices(d.services ?? []))
    fetch('/api/clinics/schedule').then(r => r.json()).then(d => setSchedule(d))
    fetch('/api/clinics/closures').then(r => r.json()).then(d => {
      setClosures((d.closures ?? []).map(c => dayjs(c.date).format('YYYY-MM-DD')))
    })
  }, [open])

  // Patient search
  useEffect(() => {
    if (!open) return
    setPatientsLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/appointments/patients?q=${encodeURIComponent(patientQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setPatients(data.patients ?? [])
        }
      } finally {
        setPatientsLoading(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [patientQuery, open])

  // Dentists for selected service
  useEffect(() => {
    if (!form.serviceId) { setDentists([]); return }
    fetch(`/api/appointments/dentists?serviceId=${form.serviceId}`)
      .then(r => r.json())
      .then(d => setDentists(d.dentists ?? []))
  }, [form.serviceId])

  // Real-time conflict check
  useEffect(() => {
    if (!form.dentistId || form.dentistId === 'ANY' || !form.date || !form.time || !form.serviceId) {
      setConflict(null)
      return
    }
    const scheduledAt = combineDatetime(form.date, form.time)
    if (!scheduledAt) return
    const params = new URLSearchParams({ dentistId: form.dentistId, scheduledAt: scheduledAt.toISOString(), serviceId: form.serviceId })
    fetch(`/api/appointments/slots/check?${params}`)
      .then(r => r.json())
      .then(d => setConflict(d))
  }, [form.dentistId, form.date, form.time, form.serviceId])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function combineDatetime(date, time) {
    if (!date || !time) return null
    return date.hour(time.hour()).minute(time.minute()).second(0).millisecond(0)
  }

  function isClosureDate(date) {
    if (!date) return false
    return closures.includes(date.format('YYYY-MM-DD'))
  }

  function isNonWorkingDay(date) {
    if (!date || !schedule?.workingDays?.length) return false
    const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    return !schedule.workingDays.includes(dayMap[date.day()])
  }

  function shouldDisableDate(date) {
    if (date.isBefore(dayjs(), 'day')) return true
    if (isNonWorkingDay(date)) return true
    if (isClosureDate(date)) return true
    return false
  }

  function validate() {
    const errs = {}
    if (!form.patient) errs.patient = 'Patient is required'
    if (!form.serviceId) errs.serviceId = 'Service is required'
    if (!form.dentistId) errs.dentistId = 'Dentist selection is required'
    if (!form.date) errs.date = 'Date is required'
    if (!form.time) errs.time = 'Time is required'
    if (conflict && !conflict.available) errs.time = 'This time slot is already booked'
    return errs
  }

  async function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const scheduledAt = combineDatetime(form.date, form.time)

    setLoading(true)
    try {
      const body = {
        patientId: form.patient.id,
        serviceId: form.serviceId,
        dentistId: form.dentistId === 'ANY' ? null : form.dentistId,
        scheduledAt: scheduledAt.toISOString(),
        notes: form.notes || undefined,
        status: form.status,
      }

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create appointment')
      }

      showToast('Appointment created', 'success')
      onSuccess()
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Compute time boundaries for picker
  const openTime  = schedule?.openTime  ? dayjs(`2000-01-01T${schedule.openTime}`)  : null
  const closeTime = schedule?.closeTime ? dayjs(`2000-01-01T${schedule.closeTime}`) : null

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth='sm'
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
      >
        {/* Header */}
        <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
            <CalendarDays size={20} color='#2563eb' />
          </Box>
          <Box>
            <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
              Create Appointment
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              Schedule a new appointment for a patient
            </Typography>
          </Box>
        </Box>

        <Divider />

        {/* Body */}
        <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Patient */}
          <Box>
            <FieldLabel required>Patient</FieldLabel>
            <Autocomplete
              options={patients}
              getOptionLabel={(o) => `${o.firstName} ${o.lastName}${o.patientCode ? ` · ${o.patientCode}` : ''}`}
              filterOptions={(x) => x}
              value={form.patient}
              onChange={(_, val) => set('patient', val)}
              inputValue={patientQuery}
              onInputChange={(_, val) => setPatientQuery(val)}
              loading={patientsLoading}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size='small'
                  placeholder='Search by name...'
                  error={!!errors.patient}
                  helperText={errors.patient}
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {patientsLoading && <CircularProgress size={16} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }
                  }}
                />
              )}
            />
          </Box>

          {/* Service */}
          <Box>
            <FieldLabel required>Service</FieldLabel>
            <FormControl fullWidth size='small' error={!!errors.serviceId}>
              <MuiSelect
                value={form.serviceId}
                onChange={(e) => { set('serviceId', e.target.value); set('dentistId', '') }}
                displayEmpty
              >
                <MenuItem value='' disabled>
                  <Typography variant='body2' color='text.disabled'>Select a service</Typography>
                </MenuItem>
                {services.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                    <Typography component='span' variant='caption' color='text.secondary' sx={{ ml: 1 }}>
                      {s.duration} min
                    </Typography>
                  </MenuItem>
                ))}
              </MuiSelect>
              {errors.serviceId && (
                <Typography variant='caption' color='error' sx={{ mt: 0.5, ml: 1.75 }}>{errors.serviceId}</Typography>
              )}
            </FormControl>
          </Box>

          {/* Dentist */}
          <Box>
            <FieldLabel required>Dentist</FieldLabel>
            <FormControl fullWidth size='small' error={!!errors.dentistId} disabled={!form.serviceId}>
              <MuiSelect
                value={form.dentistId}
                onChange={(e) => set('dentistId', e.target.value)}
                displayEmpty
              >
                <MenuItem value='' disabled>
                  <Typography variant='body2' color='text.disabled'>
                    {form.serviceId ? 'Select a dentist' : 'Select a service first'}
                  </Typography>
                </MenuItem>
                <MenuItem value='ANY'>Any Available</MenuItem>
                {dentists.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.user.firstName} {d.user.lastName}
                    {d.specialty && (
                      <Typography component='span' variant='caption' color='text.secondary' sx={{ ml: 1 }}>
                        · {d.specialty}
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </MuiSelect>
              {errors.dentistId && (
                <Typography variant='caption' color='error' sx={{ mt: 0.5, ml: 1.75 }}>{errors.dentistId}</Typography>
              )}
            </FormControl>
          </Box>

          {/* Date + Time */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <FieldLabel required>Date</FieldLabel>
              <DatePicker
                value={form.date}
                onChange={(val) => set('date', val)}
                shouldDisableDate={shouldDisableDate}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    error: !!errors.date,
                    helperText: errors.date,
                  }
                }}
              />
            </Box>
            <Box>
              <FieldLabel required>Time</FieldLabel>
              <TimePicker
                value={form.time}
                onChange={(val) => set('time', val)}
                minTime={openTime ?? undefined}
                maxTime={closeTime ?? undefined}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    error: !!errors.time,
                    helperText: errors.time,
                  }
                }}
              />
            </Box>
          </Box>

          {/* Conflict warning */}
          {conflict && !conflict.available && (
            <Alert severity='error' sx={{ py: 0.5 }}>
              This time slot conflicts with an existing appointment
              {conflict.conflict?.patientName ? ` for ${conflict.conflict.patientName}` : ''}.
            </Alert>
          )}
          {conflict && conflict.available && form.dentistId && form.dentistId !== 'ANY' && form.date && form.time && (
            <Alert severity='success' sx={{ py: 0.5 }}>Slot is available.</Alert>
          )}

          {/* Notes */}
          <Input
            id='appt-notes'
            label='Notes'
            multiline
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder='Optional notes...'
          />

          {/* Status */}
          <Box>
            <FieldLabel>Initial Status</FieldLabel>
            <FormControl fullWidth size='small'>
              <MuiSelect value={form.status} onChange={(e) => set('status', e.target.value)}>
                <MenuItem value='PENDING'>Pending</MenuItem>
                <MenuItem value='CONFIRMED'>Confirmed (walk-in)</MenuItem>
              </MuiSelect>
            </FormControl>
          </Box>

        </Box>

        <Divider />

        {/* Footer */}
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant='outlined' onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant='contained' onClick={handleSubmit} loading={loading}>Create appointment</Button>
        </Box>
      </Dialog>
    </LocalizationProvider>
  )
}
