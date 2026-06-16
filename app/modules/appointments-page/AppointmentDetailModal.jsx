'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import MuiSelect from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Tooltip from '@mui/material/Tooltip'
import { CalendarDays, AlertTriangle } from 'lucide-react'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { STATUS_CHIP } from '@/components/commons/statusColors'

// Allowed status transitions
const TRANSITIONS = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
}

function DetailRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.5 }}>
      <Typography variant='body2' color='text.secondary' sx={{ minWidth: 120 }}>{label}</Typography>
      <Typography variant='body2' color='text.primary' fontWeight={500}>{value ?? '—'}</Typography>
    </Box>
  )
}

export default function AppointmentDetailModal({ open, appointment, onClose, onSuccess, onReschedule }) {
  const { showToast } = useToast()
  const [newStatus, setNewStatus] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [noShowRisk, setNoShowRisk] = useState(null)
  const [dentists, setDentists] = useState([])
  const [assignDentistId, setAssignDentistId] = useState('')

  // "Any Available" bookings have no dentist; one must be assigned when confirming.
  const needsDentist = appointment != null && !appointment.dentist

  useEffect(() => {
    if (!open || !appointment) return
    setNewStatus(appointment.status)
    setNoShowRisk(null)
    setAssignDentistId('')
    setDentists([])
    setHistoryLoading(true)

    const patientId = appointment.patient?.id
    Promise.all([
      fetch(`/api/appointments/${appointment.id}`).then(r => r.json()),
      patientId ? fetch(`/api/ai/risk/${patientId}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
    ]).then(([detail, risk]) => {
      setHistory(detail.statusHistory ?? [])
      setNoShowRisk(risk)
    }).catch(() => {}).finally(() => setHistoryLoading(false))

    // Pre-load assignable dentists for "Any Available" bookings so the picker is ready on Confirm.
    if (!appointment.dentist && appointment.service?.id) {
      fetch(`/api/appointments/dentists?serviceIds=${appointment.service.id}`)
        .then(r => r.ok ? r.json() : { dentists: [] })
        .then(d => setDentists(d.dentists ?? []))
        .catch(() => {})
    }
  }, [open, appointment])

  const transitions = TRANSITIONS[appointment?.status] ?? []
  const isTerminal = transitions.length === 0

  const mustAssignDentist = needsDentist && newStatus === 'CONFIRMED'

  async function handleSave() {
    if (newStatus === appointment.status) { onClose(); return }
    if (mustAssignDentist && !assignDentistId) {
      showToast('Assign a dentist before confirming this appointment', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...(mustAssignDentist ? { dentistId: assignDentistId } : {}) }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update')
      }
      showToast('Appointment updated', 'success')
      onSuccess()
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!appointment) return null

  const chip = STATUS_CHIP[appointment.status] ?? { bg: '#f1f5f9', color: '#475569', label: appointment.status }

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
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
          <CalendarDays size={20} color='#2563eb' />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
              Appointment Details
            </Typography>
            <Chip label={chip.label} size='small' sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.72rem' }} />
          </Box>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25, fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {appointment.appointmentCode ?? appointment.id}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Appointment info */}
        <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, py: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant='body2' color='text.secondary' sx={{ minWidth: 120 }}>Patient</Typography>
            <Typography variant='body2' color='text.primary' fontWeight={500}>
              {appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : '—'}
            </Typography>
            {noShowRisk != null && noShowRisk.noShowCount >= 2 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 1, px: 0.75, py: 0.25 }}>
                <AlertTriangle size={12} color='#b91c1c' />
                <Typography variant='caption' color='#b91c1c' fontWeight={700} sx={{ fontSize: '0.68rem' }}>
                  {noShowRisk.noShowCount} No-shows
                </Typography>
              </Box>
            )}
            {noShowRisk?.isLastMinuteBooking && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 1, px: 0.75, py: 0.25 }}>
                <AlertTriangle size={12} color='#c2410c' />
                <Typography variant='caption' color='#c2410c' fontWeight={700} sx={{ fontSize: '0.68rem' }}>
                  &lt;24h Booking
                </Typography>
              </Box>
            )}
          </Box>
          <DetailRow
            label='Dentist'
            value={appointment.dentist ? `${appointment.dentist.user.firstName} ${appointment.dentist.user.lastName}` : 'Any available'}
          />
          <DetailRow label='Service' value={appointment.service?.name} />
          <DetailRow
            label='Scheduled'
            value={new Date(appointment.scheduledAt).toLocaleString('en-PH', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit', hour12: true,
            })}
          />
          <DetailRow
            label='Ends at'
            value={new Date(appointment.endsAt).toLocaleString('en-PH', {
              hour: 'numeric', minute: '2-digit', hour12: true,
            })}
          />
          {appointment.notes && <DetailRow label='Notes' value={appointment.notes} />}
        </Box>

        {/* No-show risk flags + suggestions */}
        {noShowRisk?.risk === 'HIGH' && (
          <Box sx={{ bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 2, px: 2, py: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <AlertTriangle size={14} color='#c2410c' />
              <Typography variant='caption' fontWeight={700} color='#c2410c'>No-show Risk Flags</Typography>
            </Box>
            {noShowRisk.noShowCount >= 2 && (
              <Typography variant='caption' color='#9a3412' sx={{ display: 'block', lineHeight: 1.8 }}>
                • <strong>No-show history:</strong> {noShowRisk.noShowCount} missed appointments on record (threshold: 2)
              </Typography>
            )}
            {noShowRisk.isLastMinuteBooking && (
              <Typography variant='caption' color='#9a3412' sx={{ display: 'block', lineHeight: 1.8 }}>
                • <strong>Last-minute booking:</strong> Appointment was booked less than 24 hours in advance
              </Typography>
            )}
            {noShowRisk.suggestions?.length > 0 && (
              <Box sx={{ mt: 0.75, pt: 0.75, borderTop: '1px solid #fed7aa' }}>
                <Typography variant='caption' fontWeight={600} color='#c2410c' sx={{ display: 'block', mb: 0.25 }}>
                  Recommended Actions
                </Typography>
                {noShowRisk.suggestions.map((s, i) => (
                  <Typography key={i} variant='caption' color='#9a3412' sx={{ display: 'block', lineHeight: 1.5 }}>
                    • {s}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Status change */}
        {!isTerminal && (
          <Box>
            <Typography variant='body2' fontWeight={500} color='text.primary' sx={{ mb: 0.75 }}>
              Update Status
            </Typography>
            <FormControl fullWidth size='small'>
              <MuiSelect value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <MenuItem value={appointment.status}>
                  {STATUS_CHIP[appointment.status]?.label ?? appointment.status} (current)
                </MenuItem>
                {transitions.map((s) => (
                  <MenuItem key={s} value={s}>{STATUS_CHIP[s]?.label ?? s}</MenuItem>
                ))}
              </MuiSelect>
            </FormControl>

            {/* "Any Available" bookings must be assigned a dentist on confirmation */}
            {mustAssignDentist && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant='body2' fontWeight={500} color='text.primary' sx={{ mb: 0.75 }}>
                  Assign Dentist <Typography component='span' color='error'>*</Typography>
                </Typography>
                {dentists.length === 0 ? (
                  <Box sx={{ bgcolor: '#fef9c3', color: '#854d0e', borderRadius: 2, px: 2, py: 1.25 }}>
                    <Typography variant='caption'>
                      No dentist is assigned to this service. Assign one in Services before confirming.
                    </Typography>
                  </Box>
                ) : (
                  <FormControl fullWidth size='small'>
                    <MuiSelect
                      value={assignDentistId}
                      onChange={(e) => setAssignDentistId(e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value='' disabled>
                        <Typography variant='body2' color='text.disabled'>Select a dentist</Typography>
                      </MenuItem>
                      {dentists.map((d) => (
                        <MenuItem key={d.id} value={d.id}>
                          {d.user.firstName} {d.user.lastName}
                        </MenuItem>
                      ))}
                    </MuiSelect>
                  </FormControl>
                )}
              </Box>
            )}
          </Box>
        )}

        {isTerminal && (
          <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, px: 2, py: 1.5 }}>
            <Typography variant='body2' color='text.secondary'>
              This appointment is in a terminal state and cannot be modified.
            </Typography>
          </Box>
        )}

        {/* Status history */}
        <Box>
          <Typography variant='body2' fontWeight={600} color='text.primary' sx={{ mb: 1 }}>
            Status History
          </Typography>
          {historyLoading && (
            <Typography variant='body2' color='text.disabled'>Loading...</Typography>
          )}
          {!historyLoading && history.length === 0 && (
            <Typography variant='body2' color='text.disabled'>No history yet</Typography>
          )}
          {!historyLoading && history.map((h, i) => {
            const hChip = STATUS_CHIP[h.status] ?? { bg: '#f1f5f9', color: '#475569', label: h.status }
            return (
              <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, borderBottom: i < history.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                <Chip label={hChip.label} size='small' sx={{ bgcolor: hChip.bg, color: hChip.color, fontWeight: 600, fontSize: '0.7rem', minWidth: 80 }} />
                <Typography variant='caption' color='text.secondary'>
                  {new Date(h.changedAt).toLocaleString('en-PH', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                </Typography>
                {h.changedBy && (
                  <Typography variant='caption' color='text.disabled'>
                    by {h.changedBy.firstName} {h.changedBy.lastName}
                  </Typography>
                )}
                {h.note && (
                  <Typography variant='caption' color='text.secondary' sx={{ fontStyle: 'italic' }}>
                    — {h.note}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={onClose} disabled={loading}>Close</Button>
        {appointment.status === 'CONFIRMED' && onReschedule && (
          <Button
            variant='outlined'
            onClick={onReschedule}
            disabled={loading}
            sx={{ borderColor: '#7c3aed', color: '#7c3aed', '&:hover': { borderColor: '#6d28d9', bgcolor: '#f5f3ff' } }}
          >
            Reschedule
          </Button>
        )}
        {!isTerminal && (
          <Button
            variant='contained'
            onClick={handleSave}
            loading={loading}
            disabled={newStatus === appointment.status || (mustAssignDentist && !assignDentistId)}
          >
            Save changes
          </Button>
        )}
      </Box>
    </Dialog>
  )
}
