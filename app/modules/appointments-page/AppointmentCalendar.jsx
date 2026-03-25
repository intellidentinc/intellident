'use client'

import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Calendar, dayjsLocalizer } from 'react-big-calendar'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import dayjs from 'dayjs'

const localizer = dayjsLocalizer(dayjs)

const STATUS_COLORS = {
  PENDING:     { bg: '#fef9c3', border: '#d97706', text: '#854d0e' },
  CONFIRMED:   { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  COMPLETED:   { bg: '#dcfce7', border: '#16a34a', text: '#15803d' },
  CANCELLED:   { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' },
  NO_SHOW:     { bg: '#f1f5f9', border: '#94a3b8', text: '#475569' },
  RESCHEDULED: { bg: '#ede9fe', border: '#8b5cf6', text: '#7c3aed' },
}

function EventComponent({ event }) {
  const appt = event.resource
  const colors = STATUS_COLORS[appt.status] ?? STATUS_COLORS.PENDING
  return (
    <Box sx={{ px: 0.5, py: 0.25, overflow: 'hidden', lineHeight: 1.3 }}>
      <Typography
        sx={{ fontSize: '0.72rem', fontWeight: 700, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : '—'}
      </Typography>
      <Typography
        sx={{ fontSize: '0.68rem', color: colors.text, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {appt.service?.name ?? ''}
      </Typography>
    </Box>
  )
}

function eventPropGetter(event) {
  const colors = STATUS_COLORS[event.resource?.status] ?? STATUS_COLORS.PENDING
  return {
    style: {
      backgroundColor: colors.bg,
      borderLeft: `3px solid ${colors.border}`,
      borderTop: 'none',
      borderRight: 'none',
      borderBottom: 'none',
      borderRadius: '4px',
      color: colors.text,
      padding: '1px 4px',
      cursor: 'pointer',
    },
  }
}

function slotPropGetter() {
  return {
    style: { borderColor: '#e2e8f0' },
  }
}

function dayPropGetter() {
  return {
    style: { backgroundColor: '#fff' },
  }
}

export default function AppointmentCalendar({ appointments, view, date, onNavigate, onView, onRangeChange, onSelectEvent, onSelectSlot }) {
  const events = appointments.map((a) => ({
    id: a.id,
    title: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—',
    start: new Date(a.scheduledAt),
    end:   new Date(a.endsAt),
    resource: a,
  }))

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
        // Override react-big-calendar default styles to fit MUI theme
        '& .rbc-calendar': { fontFamily: 'inherit', fontSize: '0.875rem' },
        '& .rbc-header': { bgcolor: '#f8fafc', borderColor: '#e2e8f0', fontWeight: 600, fontSize: '0.78rem', color: '#64748b', py: '8px' },
        '& .rbc-today': { bgcolor: '#eff6ff !important' },
        '& .rbc-off-range-bg': { bgcolor: '#f8fafc' },
        '& .rbc-show-more': { color: '#2563eb', fontWeight: 600, fontSize: '0.72rem' },
        '& .rbc-time-view': { borderColor: '#e2e8f0' },
        '& .rbc-time-header': { borderColor: '#e2e8f0' },
        '& .rbc-time-content': { borderColor: '#e2e8f0' },
        '& .rbc-timeslot-group': { borderColor: '#f1f5f9' },
        '& .rbc-time-slot': { borderColor: '#f8fafc' },
        '& .rbc-current-time-indicator': { bgcolor: '#2563eb' },
        '& .rbc-day-slot .rbc-time-slot': { borderColor: '#f1f5f9' },
        '& .rbc-month-view': { borderColor: '#e2e8f0' },
        '& .rbc-month-row': { borderColor: '#e2e8f0' },
        '& .rbc-day-bg': { borderColor: '#e2e8f0' },
        '& .rbc-date-cell': { fontSize: '0.8rem', color: '#64748b', py: '4px', px: '6px' },
        '& .rbc-date-cell.rbc-now': { '& a': { color: '#2563eb', fontWeight: 700 } },
        '& .rbc-toolbar': { display: 'none' }, // we build our own toolbar
      }}
    >
      <Calendar
        localizer={localizer}
        events={events}
        view={view}
        date={date}
        onNavigate={onNavigate}
        onView={onView}
        onRangeChange={onRangeChange}
        onSelectEvent={(e) => onSelectEvent(e.resource)}
        onSelectSlot={onSelectSlot}
        selectable
        eventPropGetter={eventPropGetter}
        slotPropGetter={slotPropGetter}
        dayPropGetter={dayPropGetter}
        components={{ event: EventComponent }}
        style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}
        step={30}
        timeslots={1}
        scrollToTime={new Date(1970, 1, 1, 8, 0)}
      />
    </Box>
  )
}
