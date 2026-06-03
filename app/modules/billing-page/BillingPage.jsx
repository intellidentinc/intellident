'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import Skeleton from '@mui/material/Skeleton'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { Search, X, Eye } from 'lucide-react'
import dayjs from 'dayjs'
import dynamic from 'next/dynamic'
const BillingDetailDrawer = dynamic(() => import('./BillingDetailDrawer'))

export const STATUS_PAYMENT_CHIP = {
  UNPAID:   { bg: '#fee2e2', color: '#b91c1c', label: 'Unpaid' },
  PARTIAL:  { bg: '#fef3c7', color: '#92400e', label: 'Partial' },
  PAID:     { bg: '#dcfce7', color: '#15803d', label: 'Paid' },
  REFUNDED: { bg: '#f3e8ff', color: '#7c3aed', label: 'Refunded' },
}

const HEAD_CELLS = [
  { id: 'appointmentCode', label: 'Appt. Code' },
  { id: 'patient',         label: 'Patient' },
  { id: 'service',         label: 'Service' },
  { id: 'amount',          label: 'Total',   align: 'right' },
  { id: 'amountPaid',      label: 'Paid',    align: 'right' },
  { id: 'balance',         label: 'Balance', align: 'right' },
  { id: 'status',          label: 'Status' },
  { id: 'actions',         label: '' },
]

function php(n) {
  if (n === null || n === undefined) return '₱—'
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function BillingPage() {
  const { clinicId } = useParams()

  const [rows, setRows]         = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus]     = useState('')
  const [search, setSearch]     = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [detail, setDetail]     = useState(null)

  const debounceRef = useRef(null)

  const fetchBillings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page:     String(page),
        pageSize: String(pageSize),
        sortField: 'createdAt',
        sortOrder: 'desc',
      })
      if (status) params.set('status', status)
      if (search) params.set('search', search)

      const res  = await fetch(`/api/billing?${params}`)
      const data = await res.json()
      setRows(data.billings ?? [])
      setTotal(data.total ?? 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, status, search])

  useEffect(() => { fetchBillings() }, [fetchBillings])

  function handleSearchInput(val) {
    setSearchInput(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(val)
      setPage(0)
    }, 350)
  }

  function handleStatusChange(val) {
    setStatus(val)
    setPage(0)
  }

  function handleDetailClose(refreshed) {
    setDetail(null)
    if (refreshed) fetchBillings()
  }

  return (
    <SidebarInset>
      <PageHeader title='Billing' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        <Typography variant='h5' fontWeight={700} color='text.primary' gutterBottom>
          Billing
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          Track payments and outstanding balances for completed appointments.
        </Typography>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
          <OutlinedInput
            size='small'
            placeholder='Search patient or appt. code…'
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            startAdornment={
              <InputAdornment position='start'>
                <Search size={15} color='#94a3b8' />
              </InputAdornment>
            }
            endAdornment={
              searchInput ? (
                <InputAdornment position='end'>
                  <IconButton size='small' onClick={() => { setSearchInput(''); setSearch(''); setPage(0) }}>
                    <X size={13} />
                  </IconButton>
                </InputAdornment>
              ) : null
            }
            sx={{ minWidth: 260, bgcolor: '#fff', fontSize: '0.875rem' }}
          />

          <FormControl size='small' sx={{ minWidth: 150 }}>
            <Select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              displayEmpty
              sx={{ bgcolor: '#fff', fontSize: '0.875rem' }}
            >
              <MenuItem value=''>All statuses</MenuItem>
              <MenuItem value='UNPAID'>Unpaid</MenuItem>
              <MenuItem value='PARTIAL'>Partial</MenuItem>
              <MenuItem value='PAID'>Paid</MenuItem>
              <MenuItem value='REFUNDED'>Refunded</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Table */}
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#fff' }}>
          <Table size='small'>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                {HEAD_CELLS.map((c) => (
                  <TableCell
                    key={c.id}
                    align={c.align ?? 'left'}
                    sx={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b', py: 1.25, whiteSpace: 'nowrap' }}
                  >
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: pageSize }).map((_, i) => (
                    <TableRow key={i}>
                      {HEAD_CELLS.map((c) => (
                        <TableCell key={c.id} align={c.align ?? 'left'}>
                          <Skeleton variant='text' width='80%' height={18} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={HEAD_CELLS.length} align='center' sx={{ py: 6, color: '#94a3b8', fontSize: '0.875rem' }}>
                        No billing records found
                      </TableCell>
                    </TableRow>
                  )
                : rows.map((row) => {
                    const chip = STATUS_PAYMENT_CHIP[row.status] ?? STATUS_PAYMENT_CHIP.UNPAID
                    return (
                      <TableRow
                        key={row.id}
                        hover
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
                        onClick={() => setDetail(row)}
                      >
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#334155' }}>
                          {row.appointment?.appointmentCode ?? '—'}
                        </TableCell>
                        <TableCell sx={{ color: '#334155', fontSize: '0.85rem' }}>
                          {row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : '—'}
                        </TableCell>
                        <TableCell sx={{ color: '#334155', fontSize: '0.85rem' }}>
                          {row.appointment?.service?.name ?? '—'}
                        </TableCell>
                        <TableCell align='right' sx={{ color: '#334155', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                          {php(row.amount)}
                        </TableCell>
                        <TableCell align='right' sx={{ color: '#15803d', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                          {php(row.amountPaid)}
                        </TableCell>
                        <TableCell align='right' sx={{ color: row.balance > 0 ? '#b91c1c' : '#15803d', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {php(row.balance)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={chip.label}
                            size='small'
                            sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size='small' onClick={(e) => { e.stopPropagation(); setDetail(row) }}>
                            <Eye size={14} color='#64748b' />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )
                  })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component='div'
          count={total}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0) }}
          sx={{ mt: 0.5, color: '#64748b', fontSize: '0.8rem' }}
        />
      </Box>

      {detail && (
        <BillingDetailDrawer
          billing={detail}
          clinicId={clinicId}
          onClose={handleDetailClose}
        />
      )}
    </SidebarInset>
  )
}
