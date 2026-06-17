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
import Menu from '@mui/material/Menu'
import CircularProgress from '@mui/material/CircularProgress'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
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
  { id: 'type',            label: 'Type' },
  { id: 'amount',          label: 'Total',   align: 'right' },
  { id: 'amountPaid',      label: 'Paid',    align: 'right' },
  { id: 'balance',         label: 'Balance', align: 'right' },
  { id: 'status',          label: 'Status' },
  { id: 'actions',         label: '' },
]

export const BILLING_TYPE_CHIP = {
  RESERVATION: { bg: '#fef3c7', color: '#92400e', label: 'Deposit' },
  SERVICE:     { bg: '#dbeafe', color: '#1d4ed8', label: 'Service' },
}

function php(n) {
  if (n === null || n === undefined) return '₱—'
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function BillingPage({ initialRows = [], initialTotal = 0 }) {
  const { clinicId } = useParams()
  const { showToast } = useToast()

  const [rows, setRows]         = useState(initialRows)
  const [total, setTotal]       = useState(initialTotal)
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus]     = useState('')
  const [search, setSearch]     = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [detail, setDetail]     = useState(null)
  const [exportAnchor, setExportAnchor] = useState(null)
  const [exporting, setExporting] = useState(false)

  const debounceRef = useRef(null)
  // The first page is server-rendered, so skip the redundant initial fetch.
  const seeded = useRef(true)

  const fetchBillings = useCallback(async () => {
    if (seeded.current) { seeded.current = false; return }
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

  // ─── Export ─────────────────────────────────────────────────────────────────
  function buildExportParams() {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    return params
  }

  async function fetchAllForExport() {
    const res = await fetch(`/api/billing/export?${buildExportParams()}`)
    if (!res.ok) throw new Error('Export failed')
    const data = await res.json()
    return data.billings ?? []
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportRow(b) {
    const dentist = b.appointment?.dentist?.user
    return [
      dayjs(b.createdAt).format('YYYY-MM-DD HH:mm'),
      b.receiptNumber ?? '',
      b.appointment?.appointmentCode ?? '',
      b.patient ? `${b.patient.firstName ?? ''} ${b.patient.lastName ?? ''}`.trim() : '',
      b.appointment?.service?.name ?? '',
      dentist ? `${dentist.firstName ?? ''} ${dentist.lastName ?? ''}`.trim() : '',
      Number(b.amount ?? 0).toFixed(2),
      Number(b.amountPaid ?? 0).toFixed(2),
      Number(b.balance ?? 0).toFixed(2),
      STATUS_PAYMENT_CHIP[b.status]?.label ?? b.status ?? '',
    ]
  }

  const EXPORT_HEADER = ['Date', 'Receipt No.', 'Appt. Code', 'Patient', 'Service', 'Dentist', 'Total', 'Paid', 'Balance', 'Status']

  async function doExportCSV() {
    setExportAnchor(null)
    setExporting(true)
    try {
      const billings = await fetchAllForExport()
      const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const lines = billings.map((b) => exportRow(b).map(escapeCell).join(','))
      const csv = [EXPORT_HEADER.join(','), ...lines].join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      triggerDownload(blob, `billing-${dayjs().format('YYYY-MM-DD')}.csv`)
    } catch {
      showToast('Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function doExportPDF() {
    setExportAnchor(null)
    setExporting(true)
    try {
      const billings = await fetchAllForExport()
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Billing', 14, 16)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      doc.text(`Exported ${dayjs().format('MMMM D, YYYY HH:mm')} · ${billings.length} records`, 14, 22)

      autoTable(doc, {
        startY: 27,
        head: [EXPORT_HEADER],
        body: billings.map(exportRow),
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right' },
        },
      })

      doc.save(`billing-${dayjs().format('YYYY-MM-DD')}.pdf`)
    } catch {
      showToast('Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <SidebarInset>
      <PageHeader title='Billing' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 3 }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary' gutterBottom>
              Billing
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Track payments and outstanding balances for completed appointments.
            </Typography>
          </Box>

          <Box
            component='button'
            onClick={(e) => setExportAnchor(e.currentTarget)}
            disabled={exporting || total === 0}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.75,
              px: 1.5, py: 0.75, border: '1px solid', borderColor: 'divider',
              borderRadius: 1.5, bgcolor: '#fff', cursor: 'pointer',
              color: '#334155', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              '&:hover:not(:disabled)': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' },
              '&:disabled': { opacity: 0.45, cursor: 'not-allowed' },
            }}
          >
            {exporting
              ? <CircularProgress size={14} sx={{ color: '#2563eb' }} />
              : <FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />
            }
            {exporting ? 'Exporting…' : 'Export'}
            <KeyboardArrowDownIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
          </Box>

          <Menu
            anchorEl={exportAnchor}
            open={Boolean(exportAnchor)}
            onClose={() => setExportAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={doExportCSV} sx={{ fontSize: '0.85rem' }}>Export as CSV</MenuItem>
            <MenuItem onClick={doExportPDF} sx={{ fontSize: '0.85rem' }}>Export as PDF</MenuItem>
          </Menu>
        </Box>

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
                    const typeChip = BILLING_TYPE_CHIP[row.billingType] ?? BILLING_TYPE_CHIP.SERVICE
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
                        <TableCell>
                          <Chip
                            label={typeChip.label}
                            size='small'
                            sx={{ bgcolor: typeChip.bg, color: typeChip.color, fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                          />
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
