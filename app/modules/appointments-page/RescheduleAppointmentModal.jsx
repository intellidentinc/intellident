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
import TextField from '@mui/material/TextField'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import { CalendarDays } from 'lucide-react'
import dayjs from 'dayjs'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'

function combineDatetime(date, time) {
  if (!date || !time) return null
  return date.hour(time.hour()).minute(time.minute()).second(0).millisecond(0)
}

export default function RescheduleAppointmentModal({ open, appointment, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [dentistId, setDentistId] = useState('')
  const [date, setDate] = useState(null)
  const [time, setTime] = useState(null)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const [dentists, setDentists] = useState([])
  const [schedule, setSchedule] = useState(null)
  const [closures, setClosures] = useState([])
  const [conflict, setConflict] = useState(null)

  useEffect(() => {
    if (!open || !appointment) return
    setDate(null)
    setTime(dayjs(appointment.scheduledAt))
    setDentistId(appointment.dentist?.id ?? 'ANY')
    setNotes(appointment.notes ?? '')
    setReason('')
    setErrors({})
    setConflict(null)

    fetch('/api/clinics/schedule').then(r => r.json()).then(d => setSchedule(d))
    fetch('/api/clinics/closures').then(r => r.json()).then(d => {
      setClosures((d.closures ?? []).map(c => dayjs(c.date).format('YYYY-MM-DD')))
    })
    if (appointment.service?.id) {
      fetch(`/api/appointments/dentists?serviceIds=${appointment.service.id}`)
        .then(r => r.json())
        .then(d => setDentists(d.dentists ?? []))
    }
  }, [open, appointment])

  // Real-time conflict check
  useEffect(() => {
    if (!dentistId || dentistId === 'ANY' || !date || !time || !appointment?.service?.id) {
      setConflict(null)
      return
    }
    const scheduledAt = combineDatetime(date, time)
    if (!scheduledAt) return
    const params = new URLSearchParams({
      dentistId,
      scheduledAt: scheduledAt.toISOString(),
      serviceIds: appointment.service.id,
      excludeAppointmentId: appointment.id,
    })
    fetch(`/api/appointments/slots/check?${params}`)
      .then(r => r.json())
      .then(d => setConflict(d))
  }, [dentistId, date, time, appointment?.id, appointment?.service?.id])

  function shouldDisableDate(d) {
    if (d.isBefore(dayjs(), 'day')) return true
    if (schedule?.workingDays?.length) {
      const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
      if (!schedule.workingDays.includes(dayMap[d.day()])) return true
    }
    if (closures.includes(d.format('YYYY-MM-DD'))) return true
    return false
  }

  async function handleSubmit() {
    const errs = {}
    if (!date) errs.date = 'New date is required'
    if (!time) errs.time = 'New time is required'
    if (!dentistId) errs.dentistId = 'Dentist is required'
    if (conflict && !conflict.available) errs.time = 'This time slot is already booked'
    if (Object.keys(errs).length) { setErrors(errs); return }

    const scheduledAt = combineDatetime(date, time)
    setLoading(true)
    try {
      const createRes = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: appointment.patient.id,
          serviceIds: [appointment.service.id],
          dentistId: dentistId === 'ANY' ? null : dentistId,
          scheduledAt: scheduledAt.toISOString(),
          notes: notes || undefined,
          status: 'CONFIRMED',
        }),
      })
      if (!createRes.ok) {
        const d = await createRes.json()
        throw new Error(d.error ?? 'Failed to create rescheduled appointment')
      }

      const patchRes = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESCHEDULED', note: reason || undefined }),
      })
      if (!patchRes.ok) {
        const d = await patchRes.json()
        throw new Error(d.error ?? 'Failed to mark original as rescheduled')
      }

      showToast('Appointment rescheduled', 'success')
      onSuccess()
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!appointment) return null

  const openTime = schedule ? dayjs(`2000-01-01T${schedule.openTime}`) : dayjs('2000-01-01T08:00')
  const closeTime = schedule ? dayjs(`2000-01-01T${schedule.closeTime}`) : dayjs('2000-01-01T17:00')

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 2, bgcolor: '#f5f3ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, mt: 0.25,
        }}>
          <CalendarDays size={20} color='#7c3aed' />
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            Reschedule Appointment
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25, fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {appointment.appointmentCode ?? appointment.id}
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Current appointment info */}
        <Box sx={{ bgcolor: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 2, px: 2, py: 1.5 }}>
          <Typography variant='caption' fontWeight={600} color='#7c3aed' sx={{ display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Appointment
          </Typography>
          {[
            ['Patient', appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : '—'],
            ['Service',   appointment.service?.name ?? '—'],
            ['Scheduled', new Date(appointment.scheduledAt).toLocaleString('en-PH', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit', hour12: true,
            })],
          ].map(([label, value]) => (
            <Box key={label} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
              <Typography variant='body2' color='text.secondary' sx={{ minWidth: 80 }}>{label}</Typography>
              <Typography variant='body2' fontWeight={500} color='text.primary'>{value}</Typography>
            </Box>
          ))}
        </Box>

        {/* New dentist */}
        <Box>
          <Typography variant='body2' fontWeight={500} color='text.primary' sx={{ mb: 0.75 }}>
            Dentist
            <Typography component='span' sx={{ color: '#E05C6A', ml: 0.25 }}>*</Typography>
          </Typography>
          <FormControl fullWidth size='small' error={!!errors.dentistId}>
            <MuiSelect
              value={dentistId}
              onChange={e => { setDentistId(e.target.value); setErrors(p => ({ ...p, dentistId: undefined })) }}
            >
              <MenuItem value='ANY'>Any Available</MenuItem>
              {dentists.map(d => (
                <MenuItem key={d.id} value={d.id}>{d.user.firstName} {d.user.lastName}</MenuItem>
              ))}
            </MuiSelect>
          </FormControl>
          {errors.dentistId && (
            <Typography variant='caption' color='error' sx={{ mt: 0.5, display: 'block' }}>{errors.dentistId}</Typography>
          )}
        </Box>

        {/* New date + time */}
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant='body2' fontWeight={500} color='text.primary' sx={{ mb: 0.75 }}>
                New Date
                <Typography component='span' sx={{ color: '#E05C6A', ml: 0.25 }}>*</Typography>
              </Typography>
              <DatePicker
                value={date}
                onChange={v => { setDate(v); setErrors(p => ({ ...p, date: undefined })) }}
                shouldDisableDate={shouldDisableDate}
                slotProps={{ textField: { size: 'small', fullWidth: true, error: !!errors.date, helperText: errors.date } }}
              />
            </Box>
            <Box>
              <Typography variant='body2' fontWeight={500} color='text.primary' sx={{ mb: 0.75 }}>
                New Time
                <Typography component='span' sx={{ color: '#E05C6A', ml: 0.25 }}>*</Typography>
              </Typography>
              <TimePicker
                value={time}
                onChange={v => { setTime(v); setErrors(p => ({ ...p, time: undefined })) }}
                minTime={openTime}
                maxTime={closeTime}
                slotProps={{ textField: { size: 'small', fullWidth: true, error: !!errors.time, helperText: errors.time } }}
              />
            </Box>
          </Box>
        </LocalizationProvider>

        {/* Conflict indicator */}
        {conflict !== null && (
          <Alert severity={conflict.available ? 'success' : 'error'} sx={{ py: 0.5 }}>
            {conflict.available
              ? 'Time slot is available'
              : `Conflict: ${conflict.conflict ?? 'dentist is already booked at this time'}`}
          </Alert>
        )}

        {/* Notes */}
        <Box>
          <Typography variant='body2' fontWeight={500} color='text.primary' sx={{ mb: 0.75 }}>
            Notes
          </Typography>
          <TextField
            multiline
            minRows={2}
            size='small'
            fullWidth
            placeholder='Notes for the rescheduled appointment (optional)'
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Box>

        {/* Reason */}
        <Box>
          <Typography variant='body2' fontWeight={500} color='text.primary' sx={{ mb: 0.75 }}>
            Reason for Rescheduling
          </Typography>
          <TextField
            size='small'
            fullWidth
            placeholder='Optional note on why this appointment was rescheduled'
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </Box>
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant='contained'
          onClick={handleSubmit}
          loading={loading}
          sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
        >
          Reschedule
        </Button>
      </Box>
    </Dialog>
  )
}
