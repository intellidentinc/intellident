'use client'

import { useState, useEffect, useCallback } from 'react'
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
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useToast } from '@/app/providers/ToastProvider'
import CreateAppointmentModal from './CreateAppointmentModal'
import AppointmentDetailModal from './AppointmentDetailModal'
import CancelAppointmentModal from './CancelAppointmentModal'

const STATUS_FILTERS = ['All', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']

const STATUS_CHIP = {
  PENDING:     { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  CONFIRMED:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  COMPLETED:   { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
  CANCELLED:   { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
  NO_SHOW:     { bg: '#f1f5f9', color: '#475569', label: 'No-show' },
  RESCHEDULED: { bg: '#ede9fe', color: '#7c3aed', label: 'Rescheduled' },
}

const HEAD_CELLS = [
  { id: 'appointmentCode', label: 'Appt. ID', sortable: false },
  { id: 'patient',         label: 'Patient',  sortable: false },
  { id: 'dentist',         label: 'Dentist',  sortable: false },
  { id: 'service',         label: 'Service',  sortable: false },
  { id: 'scheduledAt',     label: 'Date & Time', sortable: true },
  { id: 'status',          label: 'Status',   sortable: false },
  { id: 'actions',         label: 'Actions',  sortable: false, align: 'center' },
]

export default function AppointmentsPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState('scheduledAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('All')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortField,
        sortOrder,
      })
      if (statusFilter !== 'All') params.set('status', statusFilter)
      const res = await fetch(`/api/appointments?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.appointments)
      setRowCount(data.total)
    } catch {
      showToast('Failed to load appointments', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, sortField, sortOrder, statusFilter, showToast])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
    setPage(0)
  }

  const handleStatusFilter = (value) => {
    setStatusFilter(value)
    setPage(0)
  }

  const isTerminal = (status) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)

  return (
    <SidebarInset>
      <header className='flex h-14 items-center gap-3 border-b bg-white px-4'>
        <SidebarTrigger />
        <div className='h-5 w-px bg-gray-200' />
        <span className='font-semibold text-slate-700'>Appointments</span>
      </header>

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Page Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary'>
              Appointments
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              Schedule and manage patient appointments
            </Typography>
          </Box>
          <Tooltip title='Create appointment'>
            <Box
              onClick={() => setCreateOpen(true)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.25,
                px: 1.5,
                py: 1,
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: '#f1f5f9' },
                userSelect: 'none',
              }}
            >
              <AddIcon sx={{ fontSize: 22, color: '#2563eb' }} />
              <Typography variant='caption' fontWeight={600} sx={{ color: '#334155', lineHeight: 1 }}>
                Add
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        {/* Status Filter Chips */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {STATUS_FILTERS.map((s) => {
            const active = statusFilter === s
            const chipStyle = s !== 'All' && STATUS_CHIP[s]
            return (
              <Chip
                key={s}
                label={s === 'All' ? 'All' : STATUS_CHIP[s]?.label ?? s}
                size='small'
                onClick={() => handleStatusFilter(s)}
                sx={{
                  cursor: 'pointer',
                  fontWeight: active ? 700 : 500,
                  fontSize: '0.75rem',
                  bgcolor: active && chipStyle ? chipStyle.bg : active ? '#dbeafe' : '#f1f5f9',
                  color: active && chipStyle ? chipStyle.color : active ? '#1d4ed8' : '#64748b',
                  border: active ? '1.5px solid' : '1px solid transparent',
                  borderColor: active && chipStyle ? chipStyle.color : active ? '#93c5fd' : 'transparent',
                  '&:hover': { opacity: 0.85 },
                }}
              />
            )
          })}
        </Box>

        {/* Table */}
        <Box
          sx={{
            bgcolor: '#fff',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {HEAD_CELLS.map((cell) => (
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
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} align='center' sx={{ py: 6 }}>
                      <CircularProgress size={28} sx={{ color: '#2563eb' }} />
                    </TableCell>
                  </TableRow>
                )}

                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align='center' sx={{ py: 6 }}>
                      <Typography variant='body2' color='text.disabled'>
                        No appointments found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {!loading && rows.map((row) => {
                  const chip = STATUS_CHIP[row.status] ?? { bg: '#f1f5f9', color: '#475569', label: row.status }
                  const terminal = isTerminal(row.status)
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: '#f8fafc' } }}
                    >
                      <TableCell sx={{ fontWeight: 500, color: '#334155', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {row.appointmentCode ?? '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#334155' }}>
                        {row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#334155' }}>
                        {row.dentist ? `${row.dentist.user.firstName} ${row.dentist.user.lastName}` : <Typography variant='body2' color='text.disabled'>Any available</Typography>}
                      </TableCell>
                      <TableCell sx={{ color: '#334155' }}>
                        {row.service?.name ?? '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#334155', whiteSpace: 'nowrap' }}>
                        {new Date(row.scheduledAt).toLocaleString('en-PH', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit', hour12: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={chip.label}
                          size='small'
                          sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.72rem' }}
                        />
                      </TableCell>
                      <TableCell align='center'>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title='View / edit'>
                            <IconButton size='small' onClick={() => setDetailTarget(row)} sx={{ cursor: 'pointer' }}>
                              <EditOutlinedIcon fontSize='small' />
                            </IconButton>
                          </Tooltip>
                          {!terminal && (
                            <Tooltip title='Cancel appointment'>
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
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0) }}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          />
        </Box>
      </Box>

      <CreateAppointmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); fetchAppointments() }}
      />

      <AppointmentDetailModal
        open={!!detailTarget}
        appointment={detailTarget}
        onClose={() => setDetailTarget(null)}
        onSuccess={() => { setDetailTarget(null); fetchAppointments() }}
      />

      <CancelAppointmentModal
        open={!!cancelTarget}
        appointment={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onSuccess={() => { setCancelTarget(null); fetchAppointments() }}
      />
    </SidebarInset>
  )
}
