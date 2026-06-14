/**
 * BookAppointmentModal — 6-Step Patient Self-Booking Wizard
 *
 * Progressive disclosure — each step unlocks the next:
 *   Step 1: Service selection (multi-select visual cards from GET /api/appointments/services)
 *   Step 2: Dentist preference chips — "Any Available" or a specific dentist
 *           (fetched from GET /api/appointments/dentists?serviceIds=...)
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
import CircularProgress from '@mui/material/CircularProgress'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { CalendarDays, Users, Sparkles, Check } from 'lucide-react'
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

function TimeSlotRow({ slot, date, duration, selected, onClick, formatSlot }) {
  const [h, m] = slot.split(':').map(Number)
  const start = date.hour(h).minute(m).second(0)
  const end = start.add(duration, 'minute')

  const startStr = formatSlot(slot)
  const endStr = end.toDate().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
  const dateStr = date.format('ddd M/D')

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
        border: '1.5px solid',
        borderColor: selected ? '#2563eb' : '#e2e8f0',
        borderRadius: 2,
        cursor: 'pointer',
        bgcolor: selected ? '#eff6ff' : '#fff',
        transition: 'all 0.15s',
        '&:hover': {
          borderColor: '#93c5fd',
          bgcolor: selected ? '#eff6ff' : '#f8fafc',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant='body2' fontWeight={700} color={selected ? '#1d4ed8' : 'text.primary'} sx={{ minWidth: 60 }}>
          {dateStr}
        </Typography>
        <Typography variant='body2' color={selected ? '#1d4ed8' : 'text.secondary'}>
          {startStr} – {endStr}
          <Typography component='span' variant='body2' color='text.disabled' sx={{ ml: 0.75 }}>
            ({duration} min)
          </Typography>
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Users size={14} color='#22c55e' />
        <Typography variant='caption' fontWeight={700} color='#22c55e'>1</Typography>
      </Box>
    </Box>
  )
}

export default function BookAppointmentModal({ open, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  // Form state — serviceIds is now an array
  const [serviceIds, setServiceIds] = useState([])
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
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading]   = useState(false)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setServiceIds([]); setDentistId(''); setDate(null)
    setTimeSlot(''); setNotes(''); setErrors({})
    setSlots([])

    fetch('/api/appointments/services').then(r => r.json()).then(d => setServices(d.services ?? []))
    fetch('/api/clinics/schedule').then(r => r.json()).then(d => setSchedule(d))
    fetch('/api/clinics/closures').then(r => r.json()).then(d => {
      setClosures((d.closures ?? []).map(c => dayjs(c.date).format('YYYY-MM-DD')))
    })
  }, [open])

  function toggleService(id) {
    setServiceIds(prev => {
      const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
      return next
    })
    setErrors(p => ({ ...p, service: undefined }))
    // Reset downstream selections when services change
    setDentistId(''); setDate(null); setTimeSlot(''); setSlots([])
  }

  // Fetch dentists when serviceIds change
  useEffect(() => {
    if (serviceIds.length === 0) { setDentists([]); setDentistId(''); return }
    fetch(`/api/appointments/dentists?serviceIds=${serviceIds.join(',')}`)
      .then(r => r.json())
      .then(d => setDentists(d.dentists ?? []))
    setDentistId(''); setDate(null); setTimeSlot(''); setSlots([])
  }, [serviceIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch slots when date + dentist + serviceIds all set
  useEffect(() => {
    if (serviceIds.length === 0 || !dentistId || !date) { setSlots([]); setTimeSlot(''); setAiSuggestions([]); return }
    setSlotsLoading(true)
    setTimeSlot('')
    setAiSuggestions([])
    const params = new URLSearchParams({
      serviceIds: serviceIds.join(','),
      dentistId,
      date: date.format('YYYY-MM-DD'),
    })
    fetch(`/api/schedules/slots?${params}`)
      .then(r => r.json())
      .then(d => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [serviceIds.join(','), dentistId, date])  // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAiSlots() {
    if (serviceIds.length === 0 || !dentistId || !date) return
    setAiLoading(true)
    setAiSuggestions([])
    try {
      const params = new URLSearchParams({ serviceIds: serviceIds.join(','), dentistId, date: date.format('YYYY-MM-DD') })
      const res = await fetch(`/api/ai/slots?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAiSuggestions(data.suggestions ?? [])
      }
    } finally {
      setAiLoading(false)
    }
  }

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
    if (serviceIds.length === 0) errs.service  = 'Please select at least one service'
    if (!dentistId)               errs.dentist  = 'Please select a dentist preference'
    if (!date)                    errs.date     = 'Please select a date'
    if (!timeSlot)                errs.timeSlot = 'Please select a time slot'
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
          serviceIds,
          dentistId: dentistId === 'ANY' ? null : dentistId,
          scheduledAt: scheduledAt.toISOString(),
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to book')
      }
      const data = await res.json()
      if (data.checkoutUrl) {
        showToast('Redirecting to payment to secure your booking...', 'info')
        window.location.href = data.checkoutUrl
        return
      }
      showToast("Booking request submitted! We'll confirm it shortly.", 'success')
      onSuccess()
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectedServices = services.filter(s => serviceIds.includes(s.id))
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration + (s.bufferTime ?? 0), 0)
  const totalPrice    = selectedServices.reduce((sum, s) => sum + (s.price ?? 0), 0)

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

          {/* Step 1: Services (multi-select) */}
          <Box>
            <SectionLabel step={1} label='Choose one or more services' />
            {errors.service && <Typography variant='caption' color='error' sx={{ display: 'block', mb: 1 }}>{errors.service}</Typography>}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              {services.map(s => {
                const selected = serviceIds.includes(s.id)
                return (
                  <Box
                    key={s.id}
                    onClick={() => toggleService(s.id)}
                    sx={{
                      position: 'relative',
                      border: '2px solid',
                      borderColor: selected ? '#2563eb' : 'divider',
                      borderRadius: 2,
                      p: 1.75,
                      cursor: 'pointer',
                      bgcolor: selected ? '#eff6ff' : '#fff',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: '#93c5fd' },
                    }}
                  >
                    {selected && (
                      <Box sx={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', bgcolor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={11} color='#fff' strokeWidth={3} />
                      </Box>
                    )}
                    <Typography variant='body2' fontWeight={600} color='text.primary' sx={{ lineHeight: 1.3, pr: selected ? 2.5 : 0 }}>
                      {s.name}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {s.duration} min
                      {s.price != null ? ` · ₱${Number(s.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}` : ''}
                    </Typography>
                  </Box>
                )
              })}
              {services.length === 0 && (
                <Typography variant='body2' color='text.disabled' sx={{ gridColumn: 'span 2', py: 1 }}>
                  No services available.
                </Typography>
              )}
            </Box>

            {/* Running total when 2+ services selected */}
            {selectedServices.length >= 2 && (
              <Box sx={{ mt: 1.5, px: 1.5, py: 1, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 1.5, display: 'flex', gap: 2 }}>
                <Typography variant='caption' color='#0369a1' fontWeight={600}>
                  {selectedServices.length} services selected
                </Typography>
                <Typography variant='caption' color='#0369a1'>
                  {totalDuration} min total
                  {totalPrice > 0 ? ` · ₱${Number(totalPrice).toLocaleString('en-PH', { minimumFractionDigits: 0 })} total` : ''}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Step 2: Dentist preference */}
          {serviceIds.length > 0 && (
            <Box>
              <SectionLabel step={2} label='Dentist preference' />
              {errors.dentist && <Typography variant='caption' color='error' sx={{ display: 'block', mb: 1 }}>{errors.dentist}</Typography>}
              {dentists.length === 0 ? (
                <Box sx={{ bgcolor: '#fef9c3', color: '#854d0e', borderRadius: 2, px: 2, py: 1.5 }}>
                  <Typography variant='body2' sx={{ fontWeight: 500 }}>
                    No dentist is currently available for the selected service(s). Please choose another service or contact the clinic to book.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
              )}
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
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700, lineHeight: 1 }}>4</Typography>
                  </Box>
                  <Typography variant='body2' fontWeight={600} color='text.primary'>Time suggestions</Typography>
                </Box>
                <Box
                  component='button'
                  onClick={fetchAiSlots}
                  disabled={aiLoading || slotsLoading}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 1.5, cursor: aiLoading ? 'wait' : 'pointer', '&:hover:not(:disabled)': { bgcolor: '#ede9fe' } }}
                >
                  {aiLoading ? <CircularProgress size={11} sx={{ color: '#7c3aed' }} /> : <Sparkles size={11} color='#7c3aed' />}
                  <Typography variant='caption' color='#7c3aed' fontWeight={600}>{aiLoading ? 'Analyzing...' : 'AI Pick'}</Typography>
                </Box>
              </Box>
              {errors.timeSlot && <Typography variant='caption' color='error' sx={{ display: 'block', mb: 1 }}>{errors.timeSlot}</Typography>}

              {/* AI suggestions strip */}
              {aiSuggestions.length > 0 && (
                <Box sx={{ mb: 1.5, p: 1.25, bgcolor: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Sparkles size={12} color='#7c3aed' />
                    <Typography variant='caption' fontWeight={700} color='#6d28d9'>AI Recommendations</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {aiSuggestions.map((s) => (
                      <Box
                        key={s.time}
                        onClick={() => { setTimeSlot(s.time); setErrors(p => ({ ...p, timeSlot: undefined })) }}
                        sx={{ display: 'flex', flexDirection: 'column', px: 1.25, py: 0.75, border: '1.5px solid', borderColor: timeSlot === s.time ? '#7c3aed' : '#c4b5fd', borderRadius: 1.5, cursor: 'pointer', bgcolor: timeSlot === s.time ? '#ede9fe' : '#fff', '&:hover': { bgcolor: '#f5f3ff' } }}
                      >
                        <Typography variant='caption' fontWeight={700} color='#6d28d9'>
                          {(() => { const [h, m] = s.time.split(':').map(Number); const d = new Date(); d.setHours(h, m); return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }) })()}
                        </Typography>
                        <Typography variant='caption' sx={{ fontSize: '0.65rem', color: '#7c3aed' }}>{s.tag}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Typography variant='caption' color='text.disabled' sx={{ fontStyle: 'italic', display: 'block', mt: 0.75 }}>
                    AI suggestions only — not a confirmed booking.
                  </Typography>
                </Box>
              )}

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

              {!slotsLoading && slots.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {slots.map(s => (
                    <TimeSlotRow
                      key={s}
                      slot={s}
                      date={date}
                      duration={totalDuration || 30}
                      selected={timeSlot === s}
                      onClick={() => { setTimeSlot(s); setErrors(p => ({ ...p, timeSlot: undefined })) }}
                      formatSlot={formatSlot}
                    />
                  ))}
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
          {timeSlot && selectedServices.length > 0 && (
            <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, p: 2 }}>
              <Typography variant='body2' fontWeight={600} color='#15803d' sx={{ mb: 0.5 }}>
                Booking summary
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                <strong>{selectedServices.map(s => s.name).join(', ')}</strong>
                {' · '}
                {date?.format('MMM D, YYYY')}
                {' · '}
                {formatSlot(timeSlot)}
              </Typography>
              {selectedServices.length > 1 && (
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.25 }}>
                  {totalDuration} min total
                  {totalPrice > 0 ? ` · ₱${Number(totalPrice).toLocaleString('en-PH', { minimumFractionDigits: 0 })} total` : ''}
                </Typography>
              )}
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
