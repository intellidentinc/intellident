/**
 * SchedulesPage — PATIENT role only (My Schedules)
 *
 * Key features:
 *   - Two tabs: Upcoming (PENDING | CONFIRMED | RESCHEDULED, future) and Past (COMPLETED | CANCELLED | NO_SHOW)
 *   - "Book Appointment" button opens BookAppointmentModal (6-step progressive disclosure)
 *   - Appointment cards show service name, dentist, date/time, and a status chip
 *   - Cancel button is shown for PENDING and CONFIRMED appointments
 *   - Cancellation goes through CancelScheduleModal for confirmation before calling
 *     PATCH /api/schedules/[id] with { status: 'CANCELLED' }
 *   - Page re-fetches after booking or cancellation to reflect the latest state
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import Divider from '@mui/material/Divider'
import AddIcon from '@mui/icons-material/Add'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { SidebarInset } from '@/components/ui/sidebar'
import Button from '@/components/commons/Button'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import { CalendarDays, Clock, Mail, PhoneCall, User2, Stethoscope } from 'lucide-react'
import dynamic from 'next/dynamic'
const BookAppointmentModal = dynamic(() => import('./BookAppointmentModal'))
const CancelScheduleModal = dynamic(() => import('./CancelScheduleModal'))

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

function getContactValue(value) {
  return value?.trim() || null
}

function hasRebookContact(clinicContact) {
  return Boolean(
    getContactValue(clinicContact?.phone) ||
    getContactValue(clinicContact?.landline) ||
    getContactValue(clinicContact?.email)
  )
}

function formatAppointmentDateTime(appointment) {
  return new Date(appointment.scheduledAt).toLocaleString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}


function ContactRow({ icon, label, value }) {
  if (!value) return null

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, px: 2, py: 1.25 }}>
      <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant='caption' color='text.secondary' fontWeight={600}>
          {label}
        </Typography>
        <Typography variant='body2' color='text.primary' fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      </Box>
    </Box>
  )
}

function RebookContactModal({ open, appointment, clinicContact, onClose }) {
  if (!appointment) return null

  const phone = getContactValue(clinicContact?.phone)
  const landline = getContactValue(clinicContact?.landline)
  const email = getContactValue(clinicContact?.email)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='xs'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
          <PhoneCall size={20} color='#2563eb' />
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            Rebook Contact Details
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            {appointment.service?.name ?? 'Appointment'} on {formatAppointmentDateTime(appointment)}
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <ContactRow icon={<PhoneCall size={15} />} label='Phone' value={phone} />
        <ContactRow icon={<PhoneCall size={15} />} label='Landline' value={landline} />
        <ContactRow icon={<Mail size={15} />} label='Email' value={email} />
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant='outlined' onClick={onClose}>Close</Button>
      </Box>
    </Dialog>
  )
}

export default function SchedulesPage({ initialRows = null, initialTab = 'upcoming', clinicContact = null }) {
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState(initialTab)
  const [rows, setRows] = useState(initialRows ?? [])
  const [loading, setLoading] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [rebookTarget, setRebookTarget] = useState(null)
  const didAutoOpen = useRef(false)
  // When the server provided the initial tab's rows, skip the first client fetch.
  const skipNextFetch = useRef(initialRows != null)

  useEffect(() => {
    if (!didAutoOpen.current && searchParams.get('book') === '1') {
      didAutoOpen.current = true
      setBookOpen(true)
      // Remove ?book=1 so a full page refresh doesn't re-trigger the modal
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, router, pathname])

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
    if (skipNextFetch.current) {
      skipNextFetch.current = false
      return
    }
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
                clinicContact={clinicContact}
                onRebook={() => setRebookTarget(appt)}
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

      <RebookContactModal
        open={!!rebookTarget}
        appointment={rebookTarget}
        clinicContact={clinicContact}
        onClose={() => setRebookTarget(null)}
      />
    </SidebarInset>
  )
}

function AppointmentCard({ appointment, clinicContact, onRebook, onCancel }) {
  const chip = STATUS_CHIP[appointment.status] ?? { bg: '#f1f5f9', color: '#475569', label: appointment.status }
  const isCancellable = appointment.status === 'PENDING' || appointment.status === 'CONFIRMED'
  const canRebook = isCancellable && hasRebookContact(clinicContact)

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

      {/* Footer: code + actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
        <Typography variant='caption' color='text.disabled' sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
          {appointment.appointmentCode ?? '—'}
        </Typography>
        {isCancellable && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap', ml: 'auto' }}>
            {canRebook && (
              <Button
                variant='outlined'
                size='small'
                onClick={onRebook}
                startIcon={<PhoneCall size={16} />}
                sx={{
                  color: '#2563eb',
                  borderColor: '#bfdbfe',
                  '&:hover': { borderColor: '#2563eb', bgcolor: '#eff6ff' },
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                Call to rebook
              </Button>
            )}
            <Button
              variant='outlined'
              size='small'
              startIcon={<CancelOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={onCancel}
              sx={{
                color: '#b91c1c',
                borderColor: '#fecaca',
                '&:hover': { borderColor: '#dc2626', bgcolor: '#fef2f2' },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Cancel
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}
