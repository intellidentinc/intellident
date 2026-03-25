/**
 * SchedulesPage — PATIENT role only (My Schedules)
 *
 * Key features:
 *   - Two tabs: Upcoming (PENDING | CONFIRMED | RESCHEDULED, future) and Past (COMPLETED | CANCELLED | NO_SHOW)
 *   - "Book Appointment" button opens BookAppointmentModal (6-step progressive disclosure)
 *   - Appointment cards show service name, dentist, date/time, and a status chip
 *   - Cancel button is only shown for PENDING appointments — patients cannot cancel CONFIRMED ones
 *   - Cancellation goes through CancelScheduleModal for confirmation before calling
 *     PATCH /api/schedules/[id] with { status: 'CANCELLED' }
 *   - Page re-fetches after booking or cancellation to reflect the latest state
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import { CalendarDays, Clock, User2, Stethoscope } from 'lucide-react'
import BookAppointmentModal from './BookAppointmentModal'
import CancelScheduleModal from './CancelScheduleModal'

const STATUS_CHIP = {
  PENDING:     { bg: '#fef9c3', color: '#854d0e', label: 'Pending confirmation' },
  CONFIRMED:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  COMPLETED:   { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
  CANCELLED:   { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
  NO_SHOW:     { bg: '#f1f5f9', color: '#475569', label: 'No-show' },
  RESCHEDULED: { bg: '#ede9fe', color: '#7c3aed', label: 'Rescheduled' },
}

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past',     label: 'Past' },
]

export default function SchedulesPage() {
  const { showToast } = useToast()
  const [tab, setTab] = useState('upcoming')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/schedules?tab=${tab}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.appointments)
    } catch {
      showToast('Failed to load appointments', 'error')
    } finally {
      setLoading(false)
    }
  }, [tab, showToast])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  return (
    <SidebarInset>
      <PageHeader title='My Schedules' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary'>
              My Schedules
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              View your appointments and request new bookings
            </Typography>
          </Box>
          <Tooltip title='Book appointment'>
            <Box
              onClick={() => setBookOpen(true)}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 0.25, px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
                transition: 'background 0.15s', '&:hover': { bgcolor: '#f1f5f9' },
                userSelect: 'none',
              }}
            >
              <AddIcon sx={{ fontSize: 22, color: '#2563eb' }} />
              <Typography variant='caption' fontWeight={600} sx={{ color: '#334155', lineHeight: 1 }}>
                Book
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          {TABS.map((t) => (
            <Box
              key={t.key}
              onClick={() => setTab(t.key)}
              sx={{
                px: 2.5, py: 1.25, cursor: 'pointer', fontWeight: tab === t.key ? 700 : 500,
                fontSize: '0.875rem', color: tab === t.key ? '#2563eb' : '#64748b',
                borderBottom: tab === t.key ? '2.5px solid #2563eb' : '2.5px solid transparent',
                mb: '-1px', transition: 'all 0.15s',
                '&:hover': { color: '#2563eb' },
              }}
            >
              {t.label}
            </Box>
          ))}
        </Box>

        {/* Content */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} sx={{ color: '#2563eb' }} />
          </Box>
        )}

        {!loading && rows.length === 0 && (
          <Box
            sx={{
              bgcolor: '#f8fafc', border: '1.5px dashed', borderColor: '#cbd5e1',
              borderRadius: 3, p: 5, textAlign: 'center',
            }}
          >
            <CalendarDays size={36} color='#94a3b8' style={{ margin: '0 auto 12px' }} />
            <Typography variant='body1' fontWeight={600} color='text.secondary'>
              {tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
            </Typography>
            {tab === 'upcoming' && (
              <Typography
                variant='body2'
                sx={{ mt: 1, color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => setBookOpen(true)}
              >
                Book your first appointment →
              </Typography>
            )}
          </Box>
        )}

        {!loading && rows.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}>
            {rows.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                onCancel={() => setCancelTarget(appt)}
              />
            ))}
          </Box>
        )}
      </Box>

      <BookAppointmentModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onSuccess={() => { setBookOpen(false); fetchAppointments() }}
      />

      <CancelScheduleModal
        open={!!cancelTarget}
        appointment={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onSuccess={() => { setCancelTarget(null); fetchAppointments() }}
      />
    </SidebarInset>
  )
}

function AppointmentCard({ appointment, onCancel }) {
  const chip = STATUS_CHIP[appointment.status] ?? { bg: '#f1f5f9', color: '#475569', label: appointment.status }
  const isPending = appointment.status === 'PENDING'

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        position: 'relative',
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.07)' },
      }}
    >
      {/* Top row: service + status chip */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant='subtitle2' fontWeight={700} color='text.primary' sx={{ lineHeight: 1.3 }}>
          {appointment.service?.name ?? '—'}
        </Typography>
        <Chip
          label={chip.label}
          size='small'
          sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.68rem', flexShrink: 0 }}
        />
      </Box>

      {/* Date & time */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalendarDays size={15} color='#64748b' />
        <Typography variant='body2' color='text.secondary'>
          {new Date(appointment.scheduledAt).toLocaleString('en-PH', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          })}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: -1 }}>
        <Clock size={15} color='#64748b' />
        <Typography variant='body2' color='text.secondary'>
          {new Date(appointment.scheduledAt).toLocaleString('en-PH', {
            hour: 'numeric', minute: '2-digit', hour12: true,
          })}
          {' '}–{' '}
          {new Date(appointment.endsAt).toLocaleString('en-PH', {
            hour: 'numeric', minute: '2-digit', hour12: true,
          })}
        </Typography>
      </Box>

      {/* Dentist */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {appointment.dentist ? <User2 size={15} color='#64748b' /> : <Stethoscope size={15} color='#64748b' />}
        <Typography variant='body2' color='text.secondary'>
          {appointment.dentist
            ? `Dr. ${appointment.dentist.user.firstName} ${appointment.dentist.user.lastName}`
            : 'To be assigned'}
        </Typography>
      </Box>

      {/* Footer: code + cancel */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant='caption' color='text.disabled' sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
          {appointment.appointmentCode ?? '—'}
        </Typography>
        {isPending && (
          <Tooltip title='Cancel appointment'>
            <IconButton size='small' onClick={onCancel} sx={{ color: '#b91c1c', p: 0.5 }}>
              <CancelOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
