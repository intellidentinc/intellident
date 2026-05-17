'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import dayjs from 'dayjs'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
const AppointmentCalendar = dynamic(() => import('@/app/modules/appointments-page/AppointmentCalendar'), { ssr: false })
import ScheduleEventModal from './ScheduleEventModal'

const VIEWS = [
  { key: 'day',  label: 'Day' },
  { key: 'week', label: 'Week' },
]

function getRange(view, date) {
  const d = dayjs(date)
  if (view === 'week') return { from: d.startOf('week').toISOString(), to: d.endOf('week').toISOString() }
  return { from: d.startOf('day').toISOString(), to: d.endOf('day').toISOString() }
}

function formatLabel(view, date) {
  const d = dayjs(date)
  if (view === 'week') return `${d.startOf('week').format('MMM D')} – ${d.endOf('week').format('MMM D, YYYY')}`
  return d.format('dddd, MMMM D, YYYY')
}

const STATUS_CHIP = {
  PENDING:     { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  CONFIRMED:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  COMPLETED:   { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
  CANCELLED:   { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
  NO_SHOW:     { bg: '#f1f5f9', color: '#475569', label: 'No-show' },
  RESCHEDULED: { bg: '#ede9fe', color: '#7c3aed', label: 'Rescheduled' },
}

export default function SchedulePage() {
  const { showToast } = useToast()
  const [view, setView]         = useState('week')
  const [date, setDate]         = useState(new Date())
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(null)

  const fetch_ = useCallback(async () => {
    const range = getRange(view, date)
    setLoading(true)
    try {
      const res = await fetch(`/api/schedule?from=${range.from}&to=${range.to}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAppointments(data.appointments)
    } catch {
      showToast('Failed to load schedule', 'error')
    } finally {
      setLoading(false)
    }
  }, [view, date, showToast])

  useEffect(() => { fetch_() }, [fetch_])

  const navigate = (dir) => {
    const unit = view === 'week' ? 'week' : 'day'
    const d = dayjs(date)
    setDate((dir === 'prev' ? d.subtract(1, unit) : d.add(1, unit)).toDate())
  }

  // Stats for today
  const today = dayjs().format('YYYY-MM-DD')
  const todayAppts = appointments.filter(a => dayjs(a.scheduledAt).format('YYYY-MM-DD') === today)
  const confirmed  = todayAppts.filter(a => a.status === 'CONFIRMED').length
  const pending    = todayAppts.filter(a => a.status === 'PENDING').length

  return (
    <SidebarInset>
      <PageHeader title='My Schedule' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Page header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary'>My Schedule</Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              Your upcoming appointments
            </Typography>
          </Box>

          {/* Today's stat chips */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ px: 2, py: 0.75, borderRadius: 2, bgcolor: '#dbeafe', display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant='body2' fontWeight={700} sx={{ color: '#1d4ed8' }}>{confirmed}</Typography>
              <Typography variant='caption' sx={{ color: '#1d4ed8' }}>confirmed today</Typography>
            </Box>
            {pending > 0 && (
              <Box sx={{ px: 2, py: 0.75, borderRadius: 2, bgcolor: '#fef9c3', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant='body2' fontWeight={700} sx={{ color: '#854d0e' }}>{pending}</Typography>
                <Typography variant='caption' sx={{ color: '#854d0e' }}>pending today</Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Toolbar: nav + view toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <IconButton size='small' onClick={() => navigate('prev')} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <ChevronLeftIcon fontSize='small' />
          </IconButton>
          <IconButton size='small' onClick={() => navigate('next')} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <ChevronRightIcon fontSize='small' />
          </IconButton>
          <Box
            onClick={() => setDate(new Date())}
            sx={{ px: 1.5, py: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: '#334155', '&:hover': { bgcolor: '#f1f5f9' }, userSelect: 'none' }}
          >
            Today
          </Box>
          <Typography variant='subtitle2' fontWeight={700} color='text.primary' sx={{ ml: 1 }}>
            {formatLabel(view, date)}
          </Typography>
          {loading && <CircularProgress size={16} sx={{ color: '#2563eb', ml: 1 }} />}

          <Box sx={{ flex: 1 }} />

          {/* View toggle */}
          <Box sx={{ display: 'flex', bgcolor: '#f1f5f9', borderRadius: 2, p: 0.5, gap: 0.25 }}>
            {VIEWS.map(v => (
              <Box
                key={v.key}
                onClick={() => setView(v.key)}
                sx={{
                  px: 1.5, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                  fontWeight: view === v.key ? 700 : 500,
                  fontSize: '0.8rem',
                  bgcolor: view === v.key ? '#fff' : 'transparent',
                  color: view === v.key ? '#2563eb' : '#64748b',
                  boxShadow: view === v.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                  userSelect: 'none',
                  '&:hover': { color: '#2563eb' },
                }}
              >
                {v.label}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Status legend */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CHIP).map(([key, val]) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: val.bg, border: `1.5px solid ${val.color}` }} />
              <Typography variant='caption' sx={{ color: '#64748b' }}>{val.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Calendar */}
        <AppointmentCalendar
          appointments={appointments}
          view={view}
          date={date}
          onNavigate={setDate}
          onView={setView}
          onRangeChange={(range) => {
            if (Array.isArray(range) && range.length > 0) setDate(range[0])
            else if (range?.start) setDate(range.start)
          }}
          onSelectEvent={(appt) => setSelected(appt)}
          onSelectSlot={() => {}} // read-only, no slot creation
        />

      </Box>

      <ScheduleEventModal
        open={!!selected}
        appointment={selected}
        onClose={() => setSelected(null)}
      />
    </SidebarInset>
  )
}
