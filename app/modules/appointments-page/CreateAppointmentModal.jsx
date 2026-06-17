'use client'

import { Fragment, useState, useEffect } from 'react'
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
import { CalendarDays, Sparkles, AlertTriangle, Check } from 'lucide-react'
import dayjs from 'dayjs'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'

const STEPS = ['Choose Services', 'Select Dentist', 'Schedule']

const EMPTY_FORM = {
  patient: null,
  serviceIds: [],
  dentistId: '',
  date: null,
  time: null,
  notes: '',
  status: 'PENDING',
}

function StepIndicator({ current }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', px: 3, py: 2.5 }}>
      {STEPS.map((label, i) => {
        const s = i + 1
        const done = current > s
        const active = current === s
        return (
          <Fragment key={s}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, minWidth: 90 }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: done || active ? '#2563eb' : '#e2e8f0',
                color: done || active ? '#fff' : '#94a3b8',
                fontWeight: 700, fontSize: 14,
                transition: 'background-color 0.2s',
              }}>
                {done ? <Check size={15} strokeWidth={3} /> : s}
              </Box>
              <Typography
                variant='caption'
                fontWeight={active ? 700 : 400}
                color={active ? '#2563eb' : done ? 'text.secondary' : 'text.disabled'}
                sx={{ textAlign: 'center', lineHeight: 1.3 }}
              >
                {label}
              </Typography>
            </Box>
            {i < STEPS.length - 1 && (
              <Box sx={{
                flex: 1, height: 2, mt: 2.125, mx: 0.5,
                bgcolor: current > s ? '#2563eb' : '#e2e8f0',
                transition: 'background-color 0.2s',
              }} />
            )}
          </Fragment>
        )
      })}
    </Box>
  )
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

export default function CreateAppointmentModal({ open, defaultScheduledAt, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // Dropdown data
  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [patientQuery, setPatientQuery] = useState('')
  const [services, setServices] = useState([])
  const [dentists, setDentists] = useState([])
  const [closures, setClosures] = useState([])
  const [schedule, setSchedule] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [patientRisk, setPatientRisk] = useState(null)

  useEffect(() => {
    if (!open) return
    const defaultDayjs = defaultScheduledAt ? dayjs(defaultScheduledAt) : null
    setStep(1)
    setForm({ ...EMPTY_FORM, date: defaultDayjs, time: defaultDayjs })
    setErrors({})
    setConflict(null)
    setPatientQuery('')
    setAiSuggestions([])
    setPatientRisk(null)

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

  // No-show risk for selected patient
  useEffect(() => {
    if (!form.patient?.id) { setPatientRisk(null); return }
    fetch(`/api/ai/risk/${form.patient.id}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(setPatientRisk)
  }, [form.patient?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  // Dentists for selected services
  useEffect(() => {
    if (form.serviceIds.length === 0) { setDentists([]); return }
    fetch(`/api/appointments/dentists?serviceIds=${form.serviceIds.join(',')}`)
      .then(r => r.json())
      .then(d => setDentists(d.dentists ?? []))
  }, [form.serviceIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time conflict check
  useEffect(() => {
    if (!form.dentistId || form.dentistId === 'ANY' || !form.date || !form.time || form.serviceIds.length === 0) {
      setConflict(null)
      return
    }
    const scheduledAt = combineDatetime(form.date, form.time)
    if (!scheduledAt) return
    const params = new URLSearchParams({ dentistId: form.dentistId, scheduledAt: scheduledAt.toISOString(), serviceIds: form.serviceIds.join(',') })
    fetch(`/api/appointments/slots/check?${params}`)
      .then(r => r.json())
      .then(d => setConflict(d))
  }, [form.dentistId, form.date, form.time, form.serviceIds.join(',')])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function combineDatetime(date, time) {
    if (!date || !time) return null
    return date.hour(time.hour()).minute(time.minute()).second(0).millisecond(0)
  }

  async function fetchAiSlots() {
    if (form.serviceIds.length === 0 || !form.dentistId || !form.date) return
    setAiLoading(true)
    setAiSuggestions([])
    try {
      const params = new URLSearchParams({
        serviceIds: form.serviceIds.join(','),
        dentistId: form.dentistId,
        date: form.date.format('YYYY-MM-DD'),
      })
      const res = await fetch(`/api/ai/slots?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAiSuggestions(data.suggestions ?? [])
      }
    } finally {
      setAiLoading(false)
    }
  }

  function applyAiSlot(timeStr) {
    const [h, m] = timeStr.split(':').map(Number)
    set('time', dayjs().hour(h).minute(m).second(0))
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

  function validateStep1() {
    const errs = {}
    if (!form.patient) errs.patient = 'Patient is required'
    if (form.serviceIds.length === 0) errs.serviceIds = 'At least one service is required'
    return errs
  }

  function validateStep2() {
    const errs = {}
    if (!form.dentistId) errs.dentistId = 'Dentist selection is required'
    return errs
  }

  function validateStep3() {
    const errs = {}
    if (!form.date) errs.date = 'Date is required'
    if (!form.time) errs.time = 'Time is required'
    if (conflict && !conflict.available) errs.time = 'This time slot is already booked'
    return errs
  }

  function handleNext() {
    if (step === 1) {
      const errs = validateStep1()
      if (Object.keys(errs).length) { setErrors(errs); return }
      setErrors({})
      setStep(2)
    } else if (step === 2) {
      const errs = validateStep2()
      if (Object.keys(errs).length) { setErrors(errs); return }
      setErrors({})
      setStep(3)
    }
  }

  function handleBack() {
    setErrors({})
    setStep(s => s - 1)
  }

  async function handleSubmit() {
    const errs = validateStep3()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const scheduledAt = combineDatetime(form.date, form.time)
    setLoading(true)
    try {
      const body = {
        patientId: form.patient.id,
        serviceIds: form.serviceIds,
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

        {/* Step indicator */}
        <StepIndicator current={step} />

        <Divider />

        {/* Body */}
        <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 260 }}>

          {/* ── Step 1: Patient + Services ── */}
          {step === 1 && (
            <>
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

              {/* No-show risk */}
              {patientRisk?.risk === 'HIGH' && (
                <Box sx={{ bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 2, px: 2, py: 1.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                    <AlertTriangle size={14} color='#c2410c' />
                    <Typography variant='caption' fontWeight={700} color='#c2410c'>No-show Risk Flags</Typography>
                  </Box>
                  {patientRisk.noShowCount >= 2 && (
                    <Typography variant='caption' color='#9a3412' sx={{ display: 'block', lineHeight: 1.8 }}>
                      • <strong>No-show history:</strong> {patientRisk.noShowCount} missed appointments on record
                    </Typography>
                  )}
                  {patientRisk.isLastMinuteBooking && (
                    <Typography variant='caption' color='#9a3412' sx={{ display: 'block', lineHeight: 1.8 }}>
                      • <strong>Last-minute booking pattern:</strong> Most recent active booking was made less than 24 hours in advance
                    </Typography>
                  )}
                </Box>
              )}

              <Box>
                <FieldLabel required>Services</FieldLabel>
                <Autocomplete
                  multiple
                  options={services}
                  getOptionLabel={(s) => s.name}
                  value={services.filter(s => form.serviceIds.includes(s.id))}
                  onChange={(_, selected) => {
                    set('serviceIds', selected.map(s => s.id))
                    set('dentistId', '')
                  }}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  filterOptions={(x) => x}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size='small'
                      placeholder={form.serviceIds.length === 0 ? 'Select one or more services' : ''}
                      error={!!errors.serviceIds}
                      helperText={errors.serviceIds}
                    />
                  )}
                  renderOption={(props, s) => (
                    <li {...props} key={s.id}>
                      {s.name}
                      <Typography component='span' variant='caption' color='text.secondary' sx={{ ml: 1 }}>
                        {s.duration} min{s.price != null ? ` · ₱${Number(s.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}` : ''}
                      </Typography>
                    </li>
                  )}
                />
              </Box>
            </>
          )}

          {/* ── Step 2: Dentist ── */}
          {step === 2 && (
            <Box>
              <FieldLabel required>Dentist</FieldLabel>
              <FormControl fullWidth size='small' error={!!errors.dentistId}>
                <MuiSelect
                  value={form.dentistId}
                  onChange={(e) => set('dentistId', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value='' disabled>
                    <Typography variant='body2' color='text.disabled'>Select a dentist</Typography>
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
              </FormControl>
              {errors.dentistId && (
                <Typography variant='caption' color='error' sx={{ mt: 0.5, ml: 1.75, display: 'block' }}>{errors.dentistId}</Typography>
              )}
              {!errors.dentistId && dentists.length === 0 && (
                <Typography variant='caption' sx={{ mt: 0.75, color: '#854d0e', display: 'block' }}>
                  No dentists are assigned to the selected service(s). Assign one in Services for specific scheduling.
                </Typography>
              )}
            </Box>
          )}

          {/* ── Step 3: Schedule ── */}
          {step === 3 && (
            <>
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

              {/* AI Slot Suggestions */}
              {form.serviceIds.length > 0 && form.dentistId && form.date && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Sparkles size={14} color='#7c3aed' />
                      <Typography variant='body2' fontWeight={500} color='text.primary'>AI Suggested Slots</Typography>
                    </Box>
                    <Box
                      component='button'
                      onClick={fetchAiSlots}
                      disabled={aiLoading}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, bgcolor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 1.5, cursor: aiLoading ? 'wait' : 'pointer', '&:hover:not(:disabled)': { bgcolor: '#ede9fe' } }}
                    >
                      {aiLoading ? <CircularProgress size={12} sx={{ color: '#7c3aed' }} /> : <Sparkles size={12} color='#7c3aed' />}
                      <Typography variant='caption' color='#7c3aed' fontWeight={600}>{aiLoading ? 'Analyzing...' : 'Get suggestions'}</Typography>
                    </Box>
                  </Box>
                  {aiSuggestions.length > 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {aiSuggestions.map((s) => (
                        <Box
                          key={s.time}
                          onClick={() => applyAiSlot(s.time)}
                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, border: '1.5px solid', borderColor: '#ddd6fe', borderRadius: 2, cursor: 'pointer', bgcolor: '#faf5ff', '&:hover': { bgcolor: '#f5f3ff', borderColor: '#a78bfa' } }}
                        >
                          <Box>
                            <Typography variant='body2' fontWeight={700} color='#6d28d9'>{
                              (() => { const [h, m] = s.time.split(':').map(Number); const d = new Date(); d.setHours(h, m); return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }) })()
                            }</Typography>
                            {s.reason && <Typography variant='caption' color='text.secondary'>{s.reason}</Typography>}
                          </Box>
                          <Box sx={{ bgcolor: '#ede9fe', borderRadius: 1, px: 0.75, py: 0.25 }}>
                            <Typography variant='caption' color='#7c3aed' fontWeight={600} sx={{ fontSize: '0.68rem' }}>{s.tag}</Typography>
                          </Box>
                        </Box>
                      ))}
                      <Typography variant='caption' color='text.disabled' sx={{ fontStyle: 'italic', mt: 0.25 }}>
                        AI suggestions only — staff confirmation required.
                      </Typography>
                    </Box>
                  )}
                </Box>
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
            </>
          )}

        </Box>

        <Divider />

        {/* Footer */}
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            {step > 1 && (
              <Button variant='outlined' onClick={handleBack} disabled={loading}>
                ← Back
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {step === 1 && (
              <Button variant='outlined' onClick={onClose} disabled={loading}>Cancel</Button>
            )}
            {step < 3 ? (
              <Button variant='contained' onClick={handleNext}>Next →</Button>
            ) : (
              <Button variant='contained' onClick={handleSubmit} loading={loading}>Create appointment</Button>
            )}
          </Box>
        </Box>
      </Dialog>
    </LocalizationProvider>
  )
}
