'use client'

import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Button from '@/components/commons/Button'

const STATUS_CHIP = {
  PENDING:     { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  CONFIRMED:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  COMPLETED:   { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
  CANCELLED:   { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
  NO_SHOW:     { bg: '#f1f5f9', color: '#475569', label: 'No-show' },
  RESCHEDULED: { bg: '#ede9fe', color: '#7c3aed', label: 'Rescheduled' },
}

function Row({ label, value }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant='body2' color='text.secondary' sx={{ minWidth: 110, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant='body2' color='text.primary' fontWeight={500}>
        {value ?? '—'}
      </Typography>
    </Box>
  )
}

export default function ScheduleEventModal({ open, appointment, onClose }) {
  if (!appointment) return null
  const chip = STATUS_CHIP[appointment.status] ?? { bg: '#f1f5f9', color: '#475569', label: appointment.status }
  const patient = appointment.patient
    ? `${appointment.patient.firstName} ${appointment.patient.lastName}${appointment.patient.patientCode ? ` · ${appointment.patient.patientCode}` : ''}`
    : '—'
  const scheduled = new Date(appointment.scheduledAt).toLocaleString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  const ends = new Date(appointment.endsAt).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='xs'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            Appointment Details
          </Typography>
          <Typography variant='caption' color='text.secondary' sx={{ fontFamily: 'monospace' }}>
            {appointment.appointmentCode ?? ''}
          </Typography>
        </Box>
        <Chip label={chip.label} size='small' sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600 }} />
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Row label='Patient'  value={patient} />
        <Row label='Service'  value={appointment.service?.name} />
        <Row label='Date'     value={scheduled} />
        <Row label='Ends at'  value={ends} />
        {appointment.notes && <Row label='Notes' value={appointment.notes} />}
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant='outlined' onClick={onClose}>Close</Button>
      </Box>
    </Dialog>
  )
}
