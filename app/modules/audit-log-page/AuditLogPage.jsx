'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import TableSortLabel from '@mui/material/TableSortLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import FilterListIcon from '@mui/icons-material/FilterList'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import { ROLE_LABELS } from '@/lib/roles'

dayjs.extend(relativeTime)

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIONS = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE']

const ACTION_STYLES = {
  LOGIN:  { bg: '#dcfce7', color: '#15803d' },
  LOGOUT: { bg: '#f1f5f9', color: '#475569' },
  CREATE: { bg: '#dbeafe', color: '#1d4ed8' },
  UPDATE: { bg: '#fef9c3', color: '#854d0e' },
  DELETE: { bg: '#fee2e2', color: '#b91c1c' },
}

const HEAD_CELLS = [
  { id: 'expand',    label: '',           sortable: false, width: 40 },
  { id: 'createdAt', label: 'Timestamp',  sortable: true  },
  { id: 'user',      label: 'User',       sortable: false },
  { id: 'action',    label: 'Action',     sortable: true,  align: 'center' },
  { id: 'entity',    label: 'Entity',     sortable: true  },
  { id: 'entityId',  label: 'Record ID',  sortable: false },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionChip({ action }) {
  const s = ACTION_STYLES[action] ?? { bg: '#f1f5f9', color: '#334155' }
  return (
    <Chip
      label={action}
      size='small'
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.7rem', letterSpacing: 0.3 }}
    />
  )
}

function MetadataRow({ log, colSpan }) {
  const [open, setOpen] = useState(false)
  const hasDetail = log.metadata || log.userAgent

  return (
    <>
      <TableRow
        hover
        sx={{ '&:hover': { bgcolor: '#f8fafc' }, cursor: hasDetail ? 'pointer' : 'default' }}
        onClick={() => hasDetail && setOpen((v) => !v)}
      >
        <TableCell sx={{ py: 1.25, borderBottom: open ? 'none' : undefined }}>
          {hasDetail && (
            <IconButton size='small' sx={{ p: 0.25 }}>
              {open ? (
                <KeyboardArrowUpIcon fontSize='small' sx={{ color: '#94a3b8' }} />
              ) : (
                <KeyboardArrowDownIcon fontSize='small' sx={{ color: '#94a3b8' }} />
              )}
            </IconButton>
          )}
        </TableCell>

        <TableCell sx={{ py: 1.25, borderBottom: open ? 'none' : undefined }}>
          <Tooltip title={dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')} placement='top'>
            <Box>
              <Typography variant='body2' sx={{ color: '#334155', fontWeight: 500, lineHeight: 1.4 }}>
                {dayjs(log.createdAt).format('MMM D, YYYY')}
              </Typography>
              <Typography variant='caption' sx={{ color: '#94a3b8' }}>
                {dayjs(log.createdAt).format('HH:mm:ss')}
              </Typography>
            </Box>
          </Tooltip>
        </TableCell>

        <TableCell sx={{ py: 1.25, borderBottom: open ? 'none' : undefined }}>
          {log.user ? (
            <Box>
              <Typography variant='body2' sx={{ color: '#334155', fontWeight: 500, lineHeight: 1.4 }}>
                {`${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim() || '—'}
              </Typography>
              <Typography variant='caption' sx={{ color: '#94a3b8' }}>
                {log.user.email} &middot; {ROLE_LABELS[log.user.role] ?? log.user.role}
              </Typography>
            </Box>
          ) : (
            <Typography variant='body2' sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
              System
            </Typography>
          )}
        </TableCell>

        <TableCell align='center' sx={{ py: 1.25, borderBottom: open ? 'none' : undefined }}>
          <ActionChip action={log.action} />
        </TableCell>

        <TableCell sx={{ py: 1.25, borderBottom: open ? 'none' : undefined }}>
          <Typography variant='body2' sx={{ color: '#334155', fontWeight: 500 }}>
            {log.entity || '—'}
          </Typography>
        </TableCell>

        <TableCell sx={{ py: 1.25, borderBottom: open ? 'none' : undefined }}>
          {log.entityId ? (
            <Tooltip title={log.entityId}>
              <Typography
                variant='caption'
                sx={{
                  fontFamily: 'monospace',
                  color: '#64748b',
                  bgcolor: '#f1f5f9',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  display: 'inline-block',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {log.entityId}
              </Typography>
            </Tooltip>
          ) : (
            <Typography variant='body2' sx={{ color: '#94a3b8' }}>—</Typography>
          )}
        </TableCell>

      </TableRow>

      {hasDetail && (
        <TableRow>
          <TableCell colSpan={colSpan} sx={{ py: 0, border: 0 }}>
            <Collapse in={open} timeout='auto' unmountOnExit>
              <Box sx={{ px: 3, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid', borderColor: 'divider' }}>
                {log.userAgent && (
                  <Box sx={{ mb: log.metadata ? 1 : 0 }}>
                    <Typography variant='caption' sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      User Agent
                    </Typography>
                    <Typography variant='caption' sx={{ display: 'block', color: '#64748b', fontFamily: 'monospace', mt: 0.25 }}>
                      {log.userAgent}
                    </Typography>
                  </Box>
                )}
                {log.metadata && (
                  <Box>
                    <Typography variant='caption' sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Metadata
                    </Typography>
                    <Box
                      component='pre'
                      sx={{
                        mt: 0.5,
                        p: 1,
                        bgcolor: '#fff',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        fontSize: '0.72rem',
                        fontFamily: 'monospace',
                        color: '#334155',
                        overflowX: 'auto',
                        m: 0,
                        mt: 0.5,
                      }}
                    >
                      {JSON.stringify(log.metadata, null, 2)}
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const { showToast } = useToast()
  const [rows, setRows]         = useState([])
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [sortField, setSortField]   = useState('createdAt')
  const [sortOrder, setSortOrder]   = useState('desc')

  // Filters
  const [search, setSearch]       = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  // Debounce search input
  const searchTimer = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const handleSearchChange = (val) => {
    setSearch(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(0)
    }, 400)
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page:      String(page),
        pageSize:  String(pageSize),
        sortField,
        sortOrder,
        ...(actionFilter  ? { action:   actionFilter  } : {}),
        ...(entityFilter  ? { entity:   entityFilter  } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(dateFrom      ? { dateFrom              } : {}),
        ...(dateTo        ? { dateTo                } : {}),
      })
      const res = await fetch(`/api/audit-log?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.logs)
      setRowCount(data.total)
    } catch {
      showToast('Failed to load audit log', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, sortField, sortOrder, actionFilter, entityFilter, debouncedSearch, dateFrom, dateTo, showToast])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
    setPage(0)
  }

  const handleActionChip = (action) => {
    setActionFilter((prev) => (prev === action ? '' : action))
    setPage(0)
  }

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setActionFilter('')
    setEntityFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(0)
  }

  const hasFilters = search || actionFilter || entityFilter || dateFrom || dateTo

  return (
    <SidebarInset>
      <PageHeader title='Audit Log' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary'>
              Audit Log
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              Track all system activity and access events for this clinic
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
            <Typography variant='caption' sx={{ color: '#94a3b8' }}>
              {rowCount.toLocaleString()} {rowCount === 1 ? 'entry' : 'entries'}
            </Typography>
          </Box>
        </Box>

        {/* Filters */}
        <Box
          sx={{
            bgcolor: '#fff',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            p: 2,
            mb: 2,
          }}
        >
          {/* Search + date row */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              size='small'
              placeholder='Search by user, email, or record ID…'
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              sx={{ minWidth: 260, flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size='small' sx={{ minWidth: 160 }}>
              <InputLabel>Entity type</InputLabel>
              <Select
                value={entityFilter}
                label='Entity type'
                onChange={(e) => { setEntityFilter(e.target.value); setPage(0) }}
              >
                <MenuItem value=''>All entities</MenuItem>
                {['User', 'Patient', 'Appointment', 'Service', 'Clinic', 'PatientRecord', 'Billing', 'PasswordResetToken'].map((e) => (
                  <MenuItem key={e} value={e}>{e}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size='small'
              type='date'
              label='From'
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 155 }}
            />

            <TextField
              size='small'
              type='date'
              label='To'
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 155 }}
            />
          </Box>

          {/* Action filter chips */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant='caption' sx={{ color: '#94a3b8', fontWeight: 600, mr: 0.5 }}>
              Action:
            </Typography>
            <Chip
              label='All'
              size='small'
              onClick={() => handleActionChip('')}
              sx={{
                fontWeight: 600,
                fontSize: '0.72rem',
                bgcolor: !actionFilter ? '#2563eb' : '#f1f5f9',
                color:   !actionFilter ? '#fff'    : '#475569',
                '&:hover': { opacity: 0.85 },
              }}
            />
            {ACTIONS.map((a) => {
              const s = ACTION_STYLES[a]
              const active = actionFilter === a
              return (
                <Chip
                  key={a}
                  label={a}
                  size='small'
                  onClick={() => handleActionChip(a)}
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    bgcolor: active ? s.color : s.bg,
                    color:   active ? '#fff'  : s.color,
                    '&:hover': { opacity: 0.85 },
                  }}
                />
              )
            })}
            {hasFilters && (
              <Typography
                variant='caption'
                onClick={clearFilters}
                sx={{ ml: 0.5, color: '#2563eb', cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
              >
                Clear all
              </Typography>
            )}
          </Box>
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
            <Table size='small'>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {HEAD_CELLS.map((cell) => (
                    <TableCell
                      key={cell.id}
                      align={cell.align ?? 'left'}
                      width={cell.width}
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        color: '#64748b',
                        py: 1.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cell.sortable ? (
                        <TableSortLabel
                          active={sortField === cell.id}
                          direction={sortField === cell.id ? sortOrder : 'asc'}
                          onClick={() => handleSort(cell.id)}
                        >
                          {cell.label}
                        </TableSortLabel>
                      ) : (
                        cell.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={HEAD_CELLS.length} align='center' sx={{ py: 6 }}>
                      <CircularProgress size={28} sx={{ color: '#2563eb' }} />
                    </TableCell>
                  </TableRow>
                )}

                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={HEAD_CELLS.length} align='center' sx={{ py: 6 }}>
                      <InfoOutlinedIcon sx={{ fontSize: 32, color: '#cbd5e1', mb: 1 }} />
                      <Typography variant='body2' color='text.disabled'>
                        No audit log entries found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {!loading && rows.map((log) => (
                  <MetadataRow key={log.id} log={log} colSpan={HEAD_CELLS.length} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component='div'
            count={rowCount}
            page={page}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[10, 25, 50, 100]}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0) }}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          />
        </Box>
      </Box>
    </SidebarInset>
  )
}
