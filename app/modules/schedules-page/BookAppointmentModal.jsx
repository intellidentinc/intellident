/**
 * BookAppointmentModal — 6-Step Patient Self-Booking Wizard
 *
 * Progressive disclosure — each step unlocks the next:
 *   Step 1: Service selection (visual cards from GET /api/appointments/services)
 *   Step 2: Dentist preference chips — "Any Available" or a specific dentist
 *           (fetched from GET /api/appointments/dentists?serviceId=...)
 *   Step 3: DatePicker — disables non-working days and closure dates
 *           (schedule + closures fetched from GET /api/clinics/schedule and /api/clinics/closures)
 *   Step 4: Time slot chips grouped by Morning / Afternoon
 *           (fetched from GET /api/schedules/slots — filtered by conflict for specific dentist)
 *   Step 5: Optional notes textarea
 *   Step 6: Booking summary card before final submit
 *
 * Submit → POST /api/schedules → creates appointment as PENDING → staff notified.
 * The LocalizationProvider (AdapterDayjs) is wrapped inside this modal, not at app root.
 */
'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { CalendarDays } from 'lucide-react'
import dayjs from 'dayjs'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'

function SectionLabel({ step, label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700, lineHeight: 1 }}>{step}</Typography>
      </Box>
      <Typography variant='body2' fontWeight={600} color='text.primary'>{label}</Typography>
    </Box>
  )
}

export default function BookAppointmentModal({ open, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  // Form state
  const [serviceId, setServiceId]   = useState('')
  const [dentistId, setDentistId]   = useState('')
  const [date, setDate]             = useState(null)
  const [timeSlot, setTimeSlot]     = useState('')
  const [notes, setNotes]           = useState('')
  const [errors, setErrors]         = useState({})

  // Data
  const [services, setServices]     = useState([])
  const [dentists, setDentists]     = useState([])
  const [slots, setSlots]           = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [closures, setClosures]     = useState([])
  const [schedule, setSchedule]     = useState(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setServiceId(''); setDentistId(''); setDate(null)
    setTimeSlot(''); setNotes(''); setErrors({})
    setSlots([])

    fetch('/api/appointments/services').then(r => r.json()).then(d => setServices(d.services ?? []))
    fetch('/api/clinics/schedule').then(r => r.json()).then(d => setSchedule(d))
    fetch('/api/clinics/closures').then(r => r.json()).then(d => {
      setClosures((d.closures ?? []).map(c => dayjs(c.date).format('YYYY-MM-DD')))
    })
  }, [open])

  // Fetch dentists when service changes
  useEffect(() => {
    if (!serviceId) { setDentists([]); setDentistId(''); return }
    fetch(`/api/appointments/dentists?serviceId=${serviceId}`)
      .then(r => r.json())
      .then(d => setDentists(d.dentists ?? []))
    setDentistId(''); setDate(null); setTimeSlot(''); setSlots([])
  }, [serviceId])

  // Fetch slots when date + dentist + service all set
  useEffect(() => {
    if (!serviceId || !dentistId || !date) { setSlots([]); setTimeSlot(''); return }
    setSlotsLoading(true)
    setTimeSlot('')
    const params = new URLSearchParams({
      serviceId,
      dentistId,
      date: date.format('YYYY-MM-DD'),
    })
    fetch(`/api/schedules/slots?${params}`)
      .then(r => r.json())
      .then(d => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [serviceId, dentistId, date])

  function shouldDisableDate(d) {
    if (d.isBefore(dayjs(), 'day')) return true
    if (closures.includes(d.format('YYYY-MM-DD'))) return true
    if (schedule?.workingDays?.length) {
      const DAY_MAP = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
      if (!schedule.workingDays.includes(DAY_MAP[d.day()])) return true
    }
    return false
  }

  function validate() {
    const errs = {}
    if (!serviceId)  errs.service  = 'Please select a service'
    if (!dentistId)  errs.dentist  = 'Please select a dentist preference'
    if (!date)       errs.date     = 'Please select a date'
    if (!timeSlot)   errs.timeSlot = 'Please select a time slot'
    return errs
  }

  async function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const [h, m] = timeSlot.split(':').map(Number)
    const scheduledAt = date.hour(h).minute(m).second(0).millisecond(0)

    setLoading(true)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          dentistId: dentistId === 'ANY' ? null : dentistId,
          scheduledAt: scheduledAt.toISOString(),
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to book')
      }
      showToast('Appointment request submitted! We\'ll confirm it shortly.', 'success')
      onSuccess()
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectedService = services.find(s => s.id === serviceId)

  // Group slots into morning / afternoon
  const morningSlots   = slots.filter(s => parseInt(s.split(':')[0], 10) < 12)
  const afternoonSlots = slots.filter(s => parseInt(s.split(':')[0], 10) >= 12)

  function formatSlot(t) {
    const [h, m] = t.split(':').map(Number)
    const d = new Date(); d.setHours(h, m)
    return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

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
              Book an Appointment
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              Your request will be confirmed by our receptionist.
            </Typography>
          </Box>
        </Box>

        <Divider />

        <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: '65vh', overflowY: 'auto' }}>

          {/* Step 1: Service */}
          <Box>
            <SectionLabel step={1} label='Choose a service' />
            {errors.service && <Typography variant='caption' color='error' sx={{ display: 'block', mb: 1 }}>{errors.service}</Typography>}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              {services.map(s => (
                <Box
                  key={s.id}
                  onClick={() => { setServiceId(s.id); setErrors(p => ({ ...p, service: undefined })) }}
                  sx={{
                    border: '2px solid',
                    borderColor: serviceId === s.id ? '#2563eb' : 'divider',
                    borderRadius: 2,
                    p: 1.75,
                    cursor: 'pointer',
                    bgcolor: serviceId === s.id ? '#eff6ff' : '#fff',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: '#93c5fd' },
                  }}
                >
                  <Typography variant='body2' fontWeight={600} color='text.primary' sx={{ lineHeight: 1.3 }}>
                    {s.name}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {s.duration} min
                    {s.price != null ? ` · ₱${Number(s.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}` : ''}
                  </Typography>
                </Box>
              ))}
              {services.length === 0 && (
                <Typography variant='body2' color='text.disabled' sx={{ gridColumn: 'span 2', py: 1 }}>
                  No services available.
                </Typography>
              )}
            </Box>
          </Box>

          {/* Step 2: Dentist preference */}
          {serviceId && (
            <Box>
              <SectionLabel step={2} label='Dentist preference' />
              {errors.dentist && <Typography variant='caption' color='error' sx={{ display: 'block', mb: 1 }}>{errors.dentist}</Typography>}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {/* Any Available */}
                <DentistChip
                  label='Any Available'
                  selected={dentistId === 'ANY'}
                  onClick={() => { setDentistId('ANY'); setErrors(p => ({ ...p, dentist: undefined })) }}
                />
                {dentists.map(d => (
                  <DentistChip
                    key={d.id}
                    label={`Dr. ${d.user.firstName} ${d.user.lastName}`}
                    sub={d.specialty}
                    selected={dentistId === d.id}
                    onClick={() => { setDentistId(d.id); setErrors(p => ({ ...p, dentist: undefined })) }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Step 3: Date */}
          {dentistId && (
            <Box>
              <SectionLabel step={3} label='Pick a date' />
              {errors.date && <Typography variant='caption' color='error' sx={{ display: 'block', mb: 1 }}>{errors.date}</Typography>}
              <DatePicker
                value={date}
                onChange={(val) => { setDate(val); setErrors(p => ({ ...p, date: undefined })) }}
                shouldDisableDate={shouldDisableDate}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Box>
          )}

          {/* Step 4: Time slot */}
          {date && (
            <Box>
              <SectionLabel step={4} label='Select a time slot' />
              {errors.timeSlot && <Typography variant='caption' color='error' sx={{ display: 'block', mb: 1 }}>{errors.timeSlot}</Typography>}

              {slotsLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={16} sx={{ color: '#2563eb' }} />
                  <Typography variant='caption' color='text.secondary'>Loading available slots...</Typography>
                </Box>
              )}

              {!slotsLoading && slots.length === 0 && (
                <Typography variant='body2' color='text.disabled' sx={{ py: 1 }}>
                  No available slots for this date. Try a different day.
                </Typography>
              )}

              {!slotsLoading && morningSlots.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant='caption' color='text.secondary' fontWeight={600} sx={{ display: 'block', mb: 1 }}>
                    Morning
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {morningSlots.map(s => (
                      <Chip
                        key={s}
                        label={formatSlot(s)}
                        size='small'
                        onClick={() => { setTimeSlot(s); setErrors(p => ({ ...p, timeSlot: undefined })) }}
                        sx={{
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          bgcolor: timeSlot === s ? '#2563eb' : '#f1f5f9',
                          color: timeSlot === s ? '#fff' : '#334155',
                          border: timeSlot === s ? '1.5px solid #2563eb' : '1.5px solid transparent',
                          '&:hover': { bgcolor: timeSlot === s ? '#1d4ed8' : '#e2e8f0' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {!slotsLoading && afternoonSlots.length > 0 && (
                <Box>
                  <Typography variant='caption' color='text.secondary' fontWeight={600} sx={{ display: 'block', mb: 1 }}>
                    Afternoon
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {afternoonSlots.map(s => (
                      <Chip
                        key={s}
                        label={formatSlot(s)}
                        size='small'
                        onClick={() => { setTimeSlot(s); setErrors(p => ({ ...p, timeSlot: undefined })) }}
                        sx={{
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          bgcolor: timeSlot === s ? '#2563eb' : '#f1f5f9',
                          color: timeSlot === s ? '#fff' : '#334155',
                          border: timeSlot === s ? '1.5px solid #2563eb' : '1.5px solid transparent',
                          '&:hover': { bgcolor: timeSlot === s ? '#1d4ed8' : '#e2e8f0' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Step 5: Notes */}
          {timeSlot && (
            <Box>
              <SectionLabel step={5} label='Additional notes (optional)' />
              <Input
                id='book-notes'
                multiline
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder='e.g. Tooth sensitivity on the upper left...'
              />
            </Box>
          )}

          {/* Summary */}
          {timeSlot && selectedService && (
            <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, p: 2 }}>
              <Typography variant='body2' fontWeight={600} color='#15803d' sx={{ mb: 0.5 }}>
                Booking summary
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                <strong>{selectedService.name}</strong>
                {' · '}
                {date?.format('MMM D, YYYY')}
                {' · '}
                {formatSlot(timeSlot)}
              </Typography>
              <Typography variant='caption' color='text.disabled' sx={{ mt: 0.25, display: 'block' }}>
                Your request will be reviewed and confirmed by our receptionist.
              </Typography>
            </Box>
          )}

        </Box>

        <Divider />

        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant='outlined' onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant='contained' onClick={handleSubmit} loading={loading} disabled={!timeSlot}>
            Request booking
          </Button>
        </Box>
      </Dialog>
    </LocalizationProvider>
  )
}

function DentistChip({ label, sub, selected, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        border: '1.5px solid',
        borderColor: selected ? '#2563eb' : 'divider',
        borderRadius: 2,
        px: 1.5,
        py: 0.75,
        cursor: 'pointer',
        bgcolor: selected ? '#eff6ff' : '#fff',
        transition: 'all 0.15s',
        '&:hover': { borderColor: '#93c5fd' },
      }}
    >
      <Typography variant='body2' fontWeight={selected ? 700 : 500} color={selected ? '#1d4ed8' : 'text.primary'} sx={{ lineHeight: 1.2 }}>
        {label}
      </Typography>
      {sub && (
        <Typography variant='caption' color='text.secondary'>{sub}</Typography>
      )}
    </Box>
  )
}
