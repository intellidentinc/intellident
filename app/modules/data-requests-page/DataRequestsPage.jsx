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
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@/components/commons/Button'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import ReviewRequestModal from './ReviewRequestModal'

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'ACCESS', label: 'Access' },
  { value: 'CORRECTION', label: 'Correction' },
  { value: 'DELETION', label: 'Deletion' },
  { value: 'TRANSFER', label: 'Transfer' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const TYPE_CHIP = {
  ACCESS:     { label: 'Access',     sx: { bgcolor: '#ede9fe', color: '#6d28d9' } },
  CORRECTION: { label: 'Correction', sx: { bgcolor: '#fef3c7', color: '#92400e' } },
  DELETION:   { label: 'Deletion',   sx: { bgcolor: '#fee2e2', color: '#b91c1c' } },
  TRANSFER:   { label: 'Transfer',   sx: { bgcolor: '#dbeafe', color: '#1d4ed8' } },
}

const STATUS_CHIP = {
  PENDING:   { label: 'Pending',   sx: { bgcolor: '#fef9c3', color: '#854d0e' } },
  IN_REVIEW: { label: 'In Review', sx: { bgcolor: '#dbeafe', color: '#1d4ed8' } },
  RESOLVED:  { label: 'Resolved',  sx: { bgcolor: '#dcfce7', color: '#15803d' } },
  REJECTED:  { label: 'Rejected',  sx: { bgcolor: '#fee2e2', color: '#b91c1c' } },
}

const CHIP_SX = { fontWeight: 600, fontSize: '0.72rem', height: 22, borderRadius: 1 }

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DataRequestsPage() {
  const { showToast } = useToast()

  const [requests, setRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [view, setView] = useState('source')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (view === 'incoming') {
        const res = await fetch('/api/record-transfers?view=incoming')
        if (!res.ok) throw new Error()
        const data = await res.json()
        const rows = (data.transfers ?? []).map((transfer) => ({
          ...transfer.dataRequest,
          id: transfer.dataRequest.id,
          type: 'TRANSFER',
          transfer,
          user: { firstName: transfer.sourcePatient.firstName, lastName: transfer.sourcePatient.lastName, email: '' },
        }))
        setRequests(rows)
        setTotal(rows.length)
        return
      }
      const params = new URLSearchParams({ page, pageSize })
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/data-requests?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRequests(data.requests)
      setTotal(data.total)
    } catch {
      showToast('Failed to load data requests', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, typeFilter, statusFilter, view]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  function handleReview(req) {
    setSelected(req)
    setModalOpen(true)
  }

  function handleFilterChange(setter) {
    return (e) => {
      setter(e.target.value)
      setPage(0)
    }
  }

  return (
    <SidebarInset>
      <PageHeader title='Data Requests' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        <Typography variant='h5' fontWeight={700} color='text.primary' gutterBottom>
          Data Rights Requests
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          Review patient data-rights requests and controlled record transfers.
        </Typography>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Button variant={view === 'source' ? 'contained' : 'outlined'} onClick={() => { setView('source'); setPage(0) }}>Source requests</Button>
          <Button variant={view === 'incoming' ? 'contained' : 'outlined'} onClick={() => { setView('incoming'); setPage(0) }}>Incoming transfers</Button>
          {view === 'source' && <>
          <TextField
            select
            size='small'
            value={typeFilter}
            onChange={handleFilterChange(setTypeFilter)}
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            label='Type'
          >
            {TYPE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          </>}
          <TextField
            select
            size='small'
            value={statusFilter}
            onChange={handleFilterChange(setStatusFilter)}
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            label='Status'
          >
            {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
        </Box>

        <Paper variant='outlined' sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem' }}>Submitted</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem' }}>Patient</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem' }} align='right'>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align='center' sx={{ py: 4, color: '#94a3b8' }}>Loading...</TableCell>
                  </TableRow>
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align='center' sx={{ py: 4, color: '#94a3b8' }}>No data requests found.</TableCell>
                  </TableRow>
                ) : (
                  requests.map((req) => {
                    const typeChip = TYPE_CHIP[req.type] ?? { label: req.type, sx: {} }
                    const statusChip = STATUS_CHIP[req.status] ?? { label: req.status, sx: {} }
                    return (
                      <TableRow key={req.id} hover>
                        <TableCell sx={{ fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(req.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2' fontWeight={500} color='text.primary'>
                            {req.user?.firstName} {req.user?.lastName}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {req.user?.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={typeChip.label} size='small' sx={{ ...typeChip.sx, ...CHIP_SX }} />
                        </TableCell>
                        <TableCell>
                          <Chip label={statusChip.label} size='small' sx={{ ...statusChip.sx, ...CHIP_SX }} />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          <Typography variant='body2' color='text.secondary' sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.description || <em>No description</em>}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <Button
                            variant='outlined'
                            size='small'
                            onClick={() => handleReview(req)}
                            sx={{ fontSize: '0.75rem', py: 0.5, px: 1.5 }}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component='div'
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0) }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </Paper>
      </Box>

      <ReviewRequestModal
        open={modalOpen}
        dataRequest={selected}
        onClose={() => setModalOpen(false)}
        onSuccess={load}
        transferMode={view}
      />
    </SidebarInset>
  )
}
