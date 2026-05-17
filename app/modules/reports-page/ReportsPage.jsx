'use client'

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'

dayjs.extend(utc)
dayjs.extend(timezone)
const PHT = 'Asia/Manila'

const TAB_LABELS = { appointments: 'Appointments', revenue: 'Revenue', patients: 'Patients' }

const STATUS_CHIP = {
  PENDING:     { bg: '#fef9c3', color: '#854d0e' },
  CONFIRMED:   { bg: '#dbeafe', color: '#1d4ed8' },
  COMPLETED:   { bg: '#dcfce7', color: '#15803d' },
  CANCELLED:   { bg: '#fee2e2', color: '#b91c1c' },
  NO_SHOW:     { bg: '#f1f5f9', color: '#475569' },
  RESCHEDULED: { bg: '#ede9fe', color: '#7c3aed' },
  PAID:        { bg: '#dcfce7', color: '#15803d' },
  PARTIAL:     { bg: '#fef9c3', color: '#854d0e' },
  UNPAID:      { bg: '#fee2e2', color: '#b91c1c' },
  REFUNDED:    { bg: '#ede9fe', color: '#7c3aed' },
}

const phpFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const php = (v) => phpFmt.format(v ?? 0)
const pct = (n, d) => d > 0 ? `${Math.round(n / d * 100)}%` : '0%'
const fmtMonth = (yyyymm) => dayjs(`${yyyymm}-01`).format('MMM YYYY')

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatCard({ label, value, secondary }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2.5, p: 2.5 }}>
      <Typography variant='h4' fontWeight={800} color='#0f172a' sx={{ lineHeight: 1, letterSpacing: -0.5, mb: 0.5 }}>
        {value}
      </Typography>
      <Typography variant='body2' color='#64748b'>{label}</Typography>
      {secondary && (
        <Typography variant='caption' color='#94a3b8' sx={{ display: 'block', mt: 0.25 }}>
          {secondary}
        </Typography>
      )}
    </Box>
  )
}

function SectionLabel({ children }) {
  return (
    <Typography variant='overline' sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1.2, fontSize: '0.68rem', display: 'block', mb: 1 }}>
      {children}
    </Typography>
  )
}

function StatusChip({ status }) {
  const s = STATUS_CHIP[status] ?? { bg: '#f1f5f9', color: '#475569' }
  return (
    <Chip
      label={status.replace(/_/g, ' ')}
      size='small'
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: '0.68rem' }}
    />
  )
}

function BreakdownTable({ head, rows }) {
  if (!rows || rows.length === 0) {
    return (
      <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2, p: 3, textAlign: 'center' }}>
        <Typography variant='body2' color='text.secondary'>No data for the selected period</Typography>
      </Box>
    )
  }
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
      <Table size='small'>
        <TableHead>
          <TableRow sx={{ bgcolor: '#f8fafc' }}>
            {head.map((h, i) => (
              <TableCell key={i} sx={{ fontWeight: 700, color: '#475569', fontSize: '0.78rem', py: 1.25 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
              {row.map((cell, j) => (
                <TableCell key={j} sx={{ fontSize: '0.83rem', color: '#334155', py: 1.25 }}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}

// ─── Tab content components ────────────────────────────────────────────────────

function AppointmentsContent({ data }) {
  const { summary, byStatus, byService, byDentist, byMonth } = data
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
        <StatCard label='Total Appointments' value={summary.total} />
        <StatCard label='Completed' value={summary.completed} secondary={`${pct(summary.completed, summary.total)} completion rate`} />
        <StatCard label='Pending' value={summary.pending} />
        <StatCard label='Cancelled / No-show' value={summary.cancelled + summary.noShow} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        <Box>
          <SectionLabel>By Status</SectionLabel>
          <BreakdownTable
            head={['Status', 'Count', '% of Total']}
            rows={byStatus.map(s => [<StatusChip key={s.status} status={s.status} />, s.count, pct(s.count, summary.total)])}
          />
        </Box>

        <Box>
          <SectionLabel>By Service</SectionLabel>
          <BreakdownTable
            head={['Service', 'Count', '% of Total']}
            rows={byService.map(s => [s.name, s.count, pct(s.count, summary.total)])}
          />
        </Box>

        <Box>
          <SectionLabel>By Dentist</SectionLabel>
          <BreakdownTable
            head={['Dentist', 'Total', 'Completed', 'Rate']}
            rows={byDentist.map(d => [d.name, d.count, d.completed, pct(d.completed, d.count)])}
          />
        </Box>

        {byMonth.length > 0 && (
          <Box>
            <SectionLabel>By Month</SectionLabel>
            <BreakdownTable
              head={['Month', 'Appointments']}
              rows={byMonth.map(m => [fmtMonth(m.month), m.count])}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}

function RevenueContent({ data }) {
  const { summary, byStatus, byService, byMonth } = data
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
        <StatCard label='Total Billed' value={php(summary.totalBilled)} />
        <StatCard label='Total Collected' value={php(summary.totalCollected)} secondary={`${pct(summary.totalCollected, summary.totalBilled)} collection rate`} />
        <StatCard label='Outstanding Balance' value={php(summary.outstanding)} />
        <StatCard label='Total Records' value={summary.totalRecords} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        <Box>
          <SectionLabel>By Payment Status</SectionLabel>
          <BreakdownTable
            head={['Status', 'Count', 'Total Billed', 'Collected']}
            rows={byStatus.map(s => [<StatusChip key={s.status} status={s.status} />, s.count, php(s.billed), php(s.collected)])}
          />
        </Box>

        <Box>
          <SectionLabel>By Service</SectionLabel>
          <BreakdownTable
            head={['Service', 'Billed', 'Collected']}
            rows={byService.map(s => [s.name, php(s.billed), php(s.collected)])}
          />
        </Box>

        {byMonth.length > 0 && (
          <Box sx={{ gridColumn: { lg: 'span 2' } }}>
            <SectionLabel>Revenue by Month</SectionLabel>
            <BreakdownTable
              head={['Month', 'Billed', 'Collected', 'Outstanding']}
              rows={byMonth.map(m => [fmtMonth(m.month), php(m.billed), php(m.collected), php(m.billed - m.collected)])}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}

function PatientsContent({ data }) {
  const { summary, byGender, byMonth } = data
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <StatCard label='Total Patients' value={summary.total} />
        <StatCard label='New This Period' value={summary.newThisPeriod} secondary='Based on selected date range' />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        <Box>
          <SectionLabel>By Gender</SectionLabel>
          <BreakdownTable
            head={['Gender', 'Count', '% of Total']}
            rows={byGender.map(g => [
              g.gender === 'PREFER_NOT_TO_SAY' ? 'Prefer Not to Say'
                : g.gender === 'UNSPECIFIED'   ? 'Not Specified'
                : g.gender,
              g.count,
              pct(g.count, summary.total),
            ])}
          />
        </Box>

        {byMonth.length > 0 && (
          <Box>
            <SectionLabel>New Patients by Month</SectionLabel>
            <BreakdownTable
              head={['Month', 'New Patients']}
              rows={byMonth.map(m => [fmtMonth(m.month), m.count])}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab,          setTab]          = useState('appointments')
  const [dateFrom,     setDateFrom]     = useState(null)
  const [dateTo,       setDateTo]       = useState(null)
  const [data,         setData]         = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [exportAnchor, setExportAnchor] = useState(null)
  const [exporting,    setExporting]    = useState(false)
  const { showToast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setData(null)
    try {
      const params = new URLSearchParams({ type: tab })
      if (dateFrom) params.set('dateFrom', dayjs(dateFrom).format('YYYY-MM-DD'))
      if (dateTo)   params.set('dateTo',   dayjs(dateTo).format('YYYY-MM-DD'))
      const res = await fetch(`/api/reports?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      showToast('Failed to load report data', 'error')
    } finally {
      setLoading(false)
    }
  }, [tab, dateFrom, dateTo, showToast])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Export ────────────────────────────────────────────────────────────────

  async function fetchExportRows() {
    const params = new URLSearchParams({ type: tab })
    if (dateFrom) params.set('dateFrom', dayjs(dateFrom).format('YYYY-MM-DD'))
    if (dateTo)   params.set('dateTo',   dayjs(dateTo).format('YYYY-MM-DD'))
    const res = await fetch(`/api/reports/export?${params}`)
    if (!res.ok) throw new Error('Export failed')
    return (await res.json()).rows
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function getExportConfig() {
    if (tab === 'appointments') return {
      headers: ['Date', 'Appointment ID', 'Patient', 'Service', 'Dentist', 'Status'],
      buildRow: (r) => [
        dayjs(r.scheduledAt).tz(PHT).format('YYYY-MM-DD HH:mm'),
        r.appointmentCode ?? '',
        r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '',
        r.service?.name ?? '',
        r.dentist ? `${r.dentist.user.firstName} ${r.dentist.user.lastName}` : 'Any Available',
        r.status,
      ],
    }
    if (tab === 'revenue') return {
      headers: ['Date', 'Receipt No.', 'Patient', 'Service', 'Total Billed', 'Collected', 'Balance', 'Status'],
      buildRow: (r) => [
        dayjs(r.createdAt).tz(PHT).format('YYYY-MM-DD'),
        r.receiptNumber ?? '',
        r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '',
        r.appointment?.service?.name ?? '',
        r.amount     ?? 0,
        r.amountPaid ?? 0,
        r.balance    ?? 0,
        r.status,
      ],
    }
    return {
      headers: ['Patient Code', 'Name', 'Gender', 'Date of Birth', 'Registered'],
      buildRow: (r) => [
        r.patientCode ?? '',
        `${r.firstName} ${r.lastName}`,
        r.gender ?? '',
        r.dateOfBirth ? dayjs(r.dateOfBirth).format('YYYY-MM-DD') : '',
        dayjs(r.createdAt).tz(PHT).format('YYYY-MM-DD'),
      ],
    }
  }

  async function handleExportCSV() {
    setExportAnchor(null)
    setExporting(true)
    try {
      const rows = await fetchExportRows()
      const { headers, buildRow } = getExportConfig()
      const esc  = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const csv  = [headers.join(','), ...rows.map(r => buildRow(r).map(esc).join(','))].join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      triggerDownload(blob, `${tab}-report-${dayjs().tz(PHT).format('YYYY-MM-DD')}.csv`)
    } catch {
      showToast('Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPDF() {
    setExportAnchor(null)
    setExporting(true)
    try {
      const rows = await fetchExportRows()
      const { headers, buildRow } = getExportConfig()
      const { default: jsPDF }    = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const title = `${TAB_LABELS[tab]} Report`

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(title, 14, 16)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)

      const rangeLabel = (dateFrom || dateTo)
        ? `${dateFrom ? dayjs(dateFrom).format('MMM D, YYYY') : 'All time'} – ${dateTo ? dayjs(dateTo).format('MMM D, YYYY') : 'today'}`
        : 'All time'
      doc.text(`Exported ${dayjs().tz(PHT).format('MMMM D, YYYY HH:mm')} · ${rows.length} records · ${rangeLabel}`, 14, 22)

      autoTable(doc, {
        startY: 27,
        head:   [headers],
        body:   rows.map(r => buildRow(r).map(v => String(v ?? ''))),
        styles:           { fontSize: 7.5, cellPadding: 2 },
        headStyles:       { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      })

      doc.save(`${tab}-report-${dayjs().tz(PHT).format('YYYY-MM-DD')}.pdf`)
    } catch {
      showToast('Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SidebarInset>
      <PageHeader title='Reports' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary'>Reports</Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              Clinic-wide insights across appointments, revenue, and patients
            </Typography>
          </Box>

          {/* Export button */}
          <Box>
            <Box
              component='button'
              onClick={(e) => setExportAnchor(e.currentTarget)}
              disabled={exporting || !data}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1.5, py: 0.75, border: '1px solid', borderColor: 'divider',
                borderRadius: 1.5, bgcolor: '#fff', cursor: 'pointer',
                color: '#334155', fontSize: '0.8rem', fontWeight: 600,
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
              open={!!exportAnchor}
              onClose={() => setExportAnchor(null)}
              slotProps={{ paper: { sx: { borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 160 } } }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={handleExportCSV} sx={{ gap: 1.5, fontSize: '0.85rem', py: 1.25 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#15803d' }}>CSV</Typography>
                </Box>
                Export as CSV
              </MenuItem>
              <MenuItem onClick={handleExportPDF} sx={{ gap: 1.5, fontSize: '0.85rem', py: 1.25 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#b91c1c' }}>PDF</Typography>
                </Box>
                Export as PDF
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Filter bar */}
        <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2.5, p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label='From'
              value={dateFrom}
              onChange={setDateFrom}
              maxDate={dateTo ?? undefined}
              slotProps={{ textField: { size: 'small', sx: { width: 180 } } }}
            />
            <DatePicker
              label='To'
              value={dateTo}
              onChange={setDateTo}
              minDate={dateFrom ?? undefined}
              slotProps={{ textField: { size: 'small', sx: { width: 180 } } }}
            />
          </LocalizationProvider>
          {(dateFrom || dateTo) && (
            <Box
              component='button'
              onClick={() => { setDateFrom(null); setDateTo(null) }}
              sx={{ border: 'none', bgcolor: 'transparent', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500, '&:hover': { color: '#334155' } }}
            >
              Clear
            </Box>
          )}
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: '1px solid #e2e8f0', mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => { setData(null); setTab(v) }}
            sx={{ '& .MuiTab-root': { fontWeight: 600, fontSize: '0.85rem', textTransform: 'none', minWidth: 0, px: 2.5 } }}
          >
            <Tab label='Appointments' value='appointments' />
            <Tab label='Revenue'      value='revenue'      />
            <Tab label='Patients'     value='patients'     />
          </Tabs>
        </Box>

        {/* Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : !data ? null : (
          <>
            {tab === 'appointments' && <AppointmentsContent data={data} />}
            {tab === 'revenue'      && <RevenueContent      data={data} />}
            {tab === 'patients'     && <PatientsContent      data={data} />}
          </>
        )}
      </Box>
    </SidebarInset>
  )
}
