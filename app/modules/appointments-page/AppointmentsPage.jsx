/**
 * AppointmentsPage — RECEPTIONIST + ADMIN
 *
 * Key features:
 *   - Four views: Day / Week / Month (react-big-calendar) + List (MUI table)
 *   - Calendar views fetch from GET /api/appointments/calendar (date range, no pagination)
 *   - List view fetches from GET /api/appointments (paginated, sortable)
 *   - Filters: status dropdown, dentist dropdown, service dropdown + search by name / appt code
 *   - "Booking Requests" button quick-filters to PENDING and switches to List view —
 *     driven by the pendingCount badge on the sidebar
 *   - Clicking a calendar slot opens CreateAppointmentModal pre-filled with that date/time
 *     via the defaultScheduledAt prop
 *   - Clicking an event opens AppointmentDetailModal (status transitions + history timeline)
 *   - Status chips use the design system colors defined in STATUS_CHIP constant
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import TableSortLabel from '@mui/material/TableSortLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import MuiSelect from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
import dayjs from 'dayjs'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import AppointmentCalendar from './AppointmentCalendar'
import CreateAppointmentModal from './CreateAppointmentModal'
import AppointmentDetailModal from './AppointmentDetailModal'
import CancelAppointmentModal from './CancelAppointmentModal'
import RescheduleAppointmentModal from './RescheduleAppointmentModal'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CHIP = {
  PENDING:     { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  CONFIRMED:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  COMPLETED:   { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
  CANCELLED:   { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
  NO_SHOW:     { bg: '#f1f5f9', color: '#475569', label: 'No-show' },
  RESCHEDULED: { bg: '#ede9fe', color: '#7c3aed', label: 'Rescheduled' },
}

const VIEWS = [
  { key: 'day',   label: 'Day' },
  { key: 'week',  label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'list',  label: 'List' },
]

const LIST_HEAD_CELLS = [
  { id: 'appointmentCode', label: 'Appt. ID',    sortable: false },
  { id: 'patient',         label: 'Patient',     sortable: false },
  { id: 'dentist',         label: 'Dentist',     sortable: false },
  { id: 'service',         label: 'Service',     sortable: false },
  { id: 'scheduledAt',     label: 'Date & Time', sortable: true  },
  { id: 'status',          label: 'Status',      sortable: false },
  { id: 'actions',         label: 'Actions',     sortable: false, align: 'center' },
]

// Compute the calendar date range for a given view + date
function getCalendarRange(view, date) {
  const d = dayjs(date)
  if (view === 'month') return { from: d.startOf('month').subtract(7, 'day').toISOString(), to: d.endOf('month').add(7, 'day').toISOString() }
  if (view === 'week')  return { from: d.startOf('week').toISOString(), to: d.endOf('week').toISOString() }
  if (view === 'day')   return { from: d.startOf('day').toISOString(), to: d.endOf('day').toISOString() }
  return null
}

function formatCalendarLabel(view, date) {
  const d = dayjs(date)
  if (view === 'month') return d.format('MMMM YYYY')
  if (view === 'week')  return `${d.startOf('week').format('MMM D')} – ${d.endOf('week').format('MMM D, YYYY')}`
  if (view === 'day')   return d.format('dddd, MMMM D, YYYY')
  return ''
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const { showToast } = useToast()

  // View + navigation
  const [viewMode, setViewMode]       = useState('week')
  const [calendarDate, setCalendarDate] = useState(new Date())

  // Filters
  const [search, setSearch]           = useState('')
  const [dentistFilter, setDentistFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [statusFilter, setStatusFilter]   = useState('')

  // Filter options
  const [allDentists, setAllDentists] = useState([])
  const [allServices, setAllServices] = useState([])

  // Calendar data
  const [calendarAppts, setCalendarAppts] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(false)

  // List data
  const [rows, setRows]         = useState([])
  const [rowCount, setRowCount] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [page, setPage]         = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState('scheduledAt')
  const [sortOrder, setSortOrder] = useState('desc')

  // Modals
  const [createOpen, setCreateOpen]     = useState(false)
  const [createDefault, setCreateDefault] = useState(null) // pre-filled scheduledAt from slot click
  const [detailTarget, setDetailTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [rescheduleTarget, setRescheduleTarget] = useState(null)

  // Debounce search
  const searchTimeout = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(searchTimeout.current)
  }, [search])

  // Load filter options once
  useEffect(() => {
    fetch('/api/services/dentists').then(r => r.ok ? r.json() : { dentists: [] }).then(d => setAllDentists(d.dentists ?? []))
    fetch('/api/appointments/services').then(r => r.ok ? r.json() : { services: [] }).then(d => setAllServices(d.services ?? []))
  }, [])

  // ── Calendar fetch ──────────────────────────────────────────────────────────
  const fetchCalendar = useCallback(async () => {
    if (viewMode === 'list') return
    const range = getCalendarRange(viewMode, calendarDate)
    if (!range) return
    setCalendarLoading(true)
    try {
      const res = await fetch(`/api/appointments/calendar?from=${range.from}&to=${range.to}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCalendarAppts(data.appointments)
    } catch {
      showToast('Failed to load appointments', 'error')
    } finally {
      setCalendarLoading(false)
    }
  }, [viewMode, calendarDate, showToast])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  // ── List fetch ──────────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    if (viewMode !== 'list') return
    setListLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        sortField, sortOrder,
      })
      if (statusFilter)  params.set('status',    statusFilter)
      if (dentistFilter) params.set('dentistId',  dentistFilter)
      if (serviceFilter) params.set('serviceId',  serviceFilter)
      if (debouncedSearch) params.set('search',   debouncedSearch)
      const res = await fetch(`/api/appointments?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.appointments)
      setRowCount(data.total)
    } catch {
      showToast('Failed to load appointments', 'error')
    } finally {
      setListLoading(false)
    }
  }, [viewMode, page, pageSize, sortField, sortOrder, statusFilter, dentistFilter, serviceFilter, debouncedSearch, showToast])

  useEffect(() => { fetchList() }, [fetchList])

  // ── Calendar filtering (client-side on fetched data) ─────────────────────
  const filteredCalendarAppts = calendarAppts.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false
    if (dentistFilter && a.dentistId !== dentistFilter) return false
    if (serviceFilter && a.serviceId !== serviceFilter) return false
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      const name = `${a.patient?.firstName ?? ''} ${a.patient?.lastName ?? ''}`.toLowerCase()
      const code = (a.appointmentCode ?? '').toLowerCase()
      if (!name.includes(q) && !code.includes(q)) return false
    }
    return true
  })

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleCalendarNavigate = (newDate) => setCalendarDate(newDate)

  const handleCalendarRangeChange = (range) => {
    // Sync the calendarDate when react-big-calendar navigates internally
    if (Array.isArray(range) && range.length > 0) {
      setCalendarDate(range[0])
    } else if (range?.start) {
      setCalendarDate(range.start)
    }
  }

  const handleSlotSelect = ({ start }) => {
    setCreateDefault(start)
    setCreateOpen(true)
  }

  const handleSort = (field) => {
    if (sortField === field) setSortOrder(p => p === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortOrder('asc') }
    setPage(0)
  }

  const handleViewChange = (v) => {
    setViewMode(v)
    setPage(0)
  }

  const navigateCalendar = (dir) => {
    const d = dayjs(calendarDate)
    const unit = viewMode === 'month' ? 'month' : viewMode === 'week' ? 'week' : 'day'
    setCalendarDate((dir === 'prev' ? d.subtract(1, unit) : d.add(1, unit)).toDate())
  }

  const isTerminal = (s) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(s)

  const refresh = () => { fetchCalendar(); fetchList() }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SidebarInset>
      <PageHeader title='Appointments' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Page header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary'>Appointments</Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              Schedule and manage patient appointments
            </Typography>
            {/* Booking Requests quick-filter */}
            <Box
              onClick={() => { setStatusFilter('PENDING'); handleViewChange('list') }}
              sx={{
                mt: 1, display: 'inline-flex', alignItems: 'center', gap: 0.75,
                px: 1.5, py: 0.5, borderRadius: 2, cursor: 'pointer', userSelect: 'none',
                bgcolor: statusFilter === 'PENDING' ? '#fef9c3' : '#f8fafc',
                border: '1px solid',
                borderColor: statusFilter === 'PENDING' ? '#d97706' : 'divider',
                '&:hover': { bgcolor: statusFilter === 'PENDING' ? '#fef3c7' : '#f1f5f9' },
                transition: 'all 0.15s',
              }}
            >
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#d97706', flexShrink: 0 }} />
              <Typography variant='caption' fontWeight={600} sx={{ color: '#854d0e' }}>
                Booking Requests
              </Typography>
              {statusFilter !== 'PENDING' && (
                <Typography variant='caption' sx={{ color: '#94a3b8', ml: 0.25 }}>— click to filter</Typography>
              )}
              {statusFilter === 'PENDING' && (
                <Box
                  component='span'
                  onClick={(e) => { e.stopPropagation(); setStatusFilter('') }}
                  sx={{ ml: 0.5, color: '#d97706', fontWeight: 700, fontSize: '0.75rem', lineHeight: 1, cursor: 'pointer' }}
                >
                  ✕
                </Box>
              )}
            </Box>
          </Box>
          <Tooltip title='Create appointment'>
            <Box
              onClick={() => { setCreateDefault(null); setCreateOpen(true) }}
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer', transition: 'background 0.15s', '&:hover': { bgcolor: '#f1f5f9' }, userSelect: 'none' }}
            >
              <AddIcon sx={{ fontSize: 22, color: '#2563eb' }} />
              <Typography variant='caption' fontWeight={600} sx={{ color: '#334155', lineHeight: 1 }}>Add</Typography>
            </Box>
          </Tooltip>
        </Box>

        {/* Filter + View bar */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>

          {/* Search */}
          <TextField
            size='small'
            placeholder='Search patient or appt. ID...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position='start'><SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} /></InputAdornment>
              }
            }}
          />

          {/* Dentist filter */}
          <FormControl size='small' sx={{ minWidth: 150 }}>
            <MuiSelect value={dentistFilter} onChange={(e) => { setDentistFilter(e.target.value); setPage(0) }} displayEmpty>
              <MenuItem value=''>All dentists</MenuItem>
              {allDentists.map(d => (
                <MenuItem key={d.id} value={d.id}>
                  {d.user.firstName} {d.user.lastName}
                </MenuItem>
              ))}
            </MuiSelect>
          </FormControl>

          {/* Service filter */}
          <FormControl size='small' sx={{ minWidth: 150 }}>
            <MuiSelect value={serviceFilter} onChange={(e) => { setServiceFilter(e.target.value); setPage(0) }} displayEmpty>
              <MenuItem value=''>All services</MenuItem>
              {allServices.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </MuiSelect>
          </FormControl>

          {/* Status filter */}
          <FormControl size='small' sx={{ minWidth: 130 }}>
            <MuiSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }} displayEmpty>
              <MenuItem value=''>All statuses</MenuItem>
              {Object.entries(STATUS_CHIP).map(([key, val]) => (
                <MenuItem key={key} value={key}>{val.label}</MenuItem>
              ))}
            </MuiSelect>
          </FormControl>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* View mode toggle */}
          <Box sx={{ display: 'flex', bgcolor: '#f1f5f9', borderRadius: 2, p: 0.5, gap: 0.25 }}>
            {VIEWS.map(v => (
              <Box
                key={v.key}
                onClick={() => handleViewChange(v.key)}
                sx={{
                  px: 1.5, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                  fontWeight: viewMode === v.key ? 700 : 500,
                  fontSize: '0.8rem',
                  bgcolor: viewMode === v.key ? '#fff' : 'transparent',
                  color: viewMode === v.key ? '#2563eb' : '#64748b',
                  boxShadow: viewMode === v.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
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

        {/* Calendar navigation bar */}
        {viewMode !== 'list' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size='small' onClick={() => navigateCalendar('prev')} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <ChevronLeftIcon fontSize='small' />
            </IconButton>
            <IconButton size='small' onClick={() => navigateCalendar('next')} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <ChevronRightIcon fontSize='small' />
            </IconButton>
            <Box
              onClick={() => setCalendarDate(new Date())}
              sx={{ px: 1.5, py: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: '#334155', '&:hover': { bgcolor: '#f1f5f9' }, userSelect: 'none' }}
            >
              Today
            </Box>
            <Typography variant='subtitle2' fontWeight={700} color='text.primary' sx={{ ml: 1 }}>
              {formatCalendarLabel(viewMode, calendarDate)}
            </Typography>
            {calendarLoading && <CircularProgress size={16} sx={{ color: '#2563eb', ml: 1 }} />}
          </Box>
        )}

        {/* Calendar view */}
        {viewMode !== 'list' && (
          <AppointmentCalendar
            appointments={filteredCalendarAppts}
            view={viewMode}
            date={calendarDate}
            onNavigate={handleCalendarNavigate}
            onView={handleViewChange}
            onRangeChange={handleCalendarRangeChange}
            onSelectEvent={(appt) => setDetailTarget(appt)}
            onSelectSlot={handleSlotSelect}
          />
        )}

        {/* List view */}
        {viewMode === 'list' && (
          <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    {LIST_HEAD_CELLS.map((cell) => (
                      <TableCell
                        key={cell.id}
                        align={cell.align ?? 'left'}
                        sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
                      >
                        {cell.sortable ? (
                          <TableSortLabel
                            active={sortField === cell.id}
                            direction={sortField === cell.id ? sortOrder : 'asc'}
                            onClick={() => handleSort(cell.id)}
                          >
                            {cell.label}
                          </TableSortLabel>
                        ) : cell.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listLoading && (
                    <TableRow><TableCell colSpan={7} align='center' sx={{ py: 6 }}><CircularProgress size={28} sx={{ color: '#2563eb' }} /></TableCell></TableRow>
                  )}
                  {!listLoading && rows.length === 0 && (
                    <TableRow><TableCell colSpan={7} align='center' sx={{ py: 6 }}><Typography variant='body2' color='text.disabled'>No appointments found</Typography></TableCell></TableRow>
                  )}
                  {!listLoading && rows.map((row) => {
                    const chip = STATUS_CHIP[row.status] ?? { bg: '#f1f5f9', color: '#475569', label: row.status }
                    return (
                      <TableRow key={row.id} hover sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: '#f8fafc' } }}>
                        <TableCell sx={{ fontWeight: 500, color: '#334155', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {row.appointmentCode ?? '—'}
                        </TableCell>
                        <TableCell sx={{ color: '#334155' }}>
                          {row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : '—'}
                        </TableCell>
                        <TableCell sx={{ color: '#334155' }}>
                          {row.dentist ? `${row.dentist.user.firstName} ${row.dentist.user.lastName}` : <Typography variant='body2' color='text.disabled'>Any available</Typography>}
                        </TableCell>
                        <TableCell sx={{ color: '#334155' }}>{row.service?.name ?? '—'}</TableCell>
                        <TableCell sx={{ color: '#334155', whiteSpace: 'nowrap' }}>
                          {new Date(row.scheduledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </TableCell>
                        <TableCell>
                          <Chip label={chip.label} size='small' sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.72rem' }} />
                        </TableCell>
                        <TableCell align='center'>
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title='View / edit'>
                              <IconButton size='small' onClick={() => setDetailTarget(row)} sx={{ cursor: 'pointer' }}>
                                <EditOutlinedIcon fontSize='small' />
                              </IconButton>
                            </Tooltip>
                            {row.status === 'CONFIRMED' && (
                              <Tooltip title='Reschedule'>
                                <IconButton size='small' onClick={() => setRescheduleTarget(row)} sx={{ cursor: 'pointer', color: '#7c3aed' }}>
                                  <EventRepeatIcon fontSize='small' />
                                </IconButton>
                              </Tooltip>
                            )}
                            {!isTerminal(row.status) && (
                              <Tooltip title='Cancel'>
                                <IconButton size='small' onClick={() => setCancelTarget(row)} sx={{ cursor: 'pointer', color: '#b91c1c' }}>
                                  <CancelOutlinedIcon fontSize='small' />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component='div'
              count={rowCount}
              page={page}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[10, 25, 50]}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0) }}
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            />
          </Box>
        )}
      </Box>

      <CreateAppointmentModal
        open={createOpen}
        defaultScheduledAt={createDefault}
        onClose={() => { setCreateOpen(false); setCreateDefault(null) }}
        onSuccess={() => { setCreateOpen(false); setCreateDefault(null); refresh() }}
      />
      <AppointmentDetailModal
        open={!!detailTarget}
        appointment={detailTarget}
        onClose={() => setDetailTarget(null)}
        onSuccess={() => { setDetailTarget(null); refresh() }}
        onReschedule={() => { setRescheduleTarget(detailTarget); setDetailTarget(null) }}
      />
      <CancelAppointmentModal
        open={!!cancelTarget}
        appointment={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onSuccess={() => { setCancelTarget(null); refresh() }}
      />
      <RescheduleAppointmentModal
        open={!!rescheduleTarget}
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSuccess={() => { setRescheduleTarget(null); refresh() }}
      />
    </SidebarInset>
  )
}
