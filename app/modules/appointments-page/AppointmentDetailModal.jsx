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
import { CalendarDays } from 'lucide-react'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'

const STATUS_CHIP = {
  PENDING:     { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  CONFIRMED:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  COMPLETED:   { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
  CANCELLED:   { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
  NO_SHOW:     { bg: '#f1f5f9', color: '#475569', label: 'No-show' },
  RESCHEDULED: { bg: '#ede9fe', color: '#7c3aed', label: 'Rescheduled' },
}

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

export default function AppointmentDetailModal({ open, appointment, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [newStatus, setNewStatus] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (!open || !appointment) return
    setNewStatus(appointment.status)
    setHistoryLoading(true)
    fetch(`/api/appointments/${appointment.id}`)
      .then(r => r.json())
      .then(d => setHistory(d.statusHistory ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [open, appointment])

  const transitions = TRANSITIONS[appointment?.status] ?? []
  const isTerminal = transitions.length === 0

  async function handleSave() {
    if (newStatus === appointment.status) { onClose(); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
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
          <DetailRow
            label='Patient'
            value={appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : null}
          />
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
        {!isTerminal && (
          <Button variant='contained' onClick={handleSave} loading={loading} disabled={newStatus === appointment.status}>
            Save changes
          </Button>
        )}
      </Box>
    </Dialog>
  )
}
