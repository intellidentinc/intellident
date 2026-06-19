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
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import dynamic from 'next/dynamic'
const PatientRecordsDrawer = dynamic(() => import('./PatientRecordsDrawer'))

const STATUS_CHIP = {
  CONFIRMED: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  COMPLETED: { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
}

export default function RecordsPage() {
  const { showToast } = useToast()
  const [rows, setRows]         = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch]     = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [stepUpGranted, setStepUpGranted] = useState(false)

  const searchTimeout = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(searchTimeout.current)
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/records?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.patients)
      setTotal(data.total)
    } catch {
      showToast('Failed to load patient records', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, showToast])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <SidebarInset>
      <PageHeader title='Patient Records' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

        <Box>
          <Typography variant='h5' fontWeight={700} color='text.primary'>Patient Records</Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            Patients with confirmed or completed appointments with you
          </Typography>
        </Box>

        {/* Search */}
        <Box>
          <TextField
            size='small'
            placeholder='Search by name or patient ID...'
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            sx={{ minWidth: 260 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position='start'>
                    <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        {/* Table */}
        <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {['Patient ID', 'Name', 'Last Service', 'Last Visit', 'Status', 'Total Visits'].map((label) => (
                    <TableCell
                      key={label}
                      sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      {label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} align='center' sx={{ py: 6 }}>
                      <CircularProgress size={28} sx={{ color: '#2563eb' }} />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align='center' sx={{ py: 6 }}>
                      <Typography variant='body2' color='text.disabled'>No patient records found</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.map((patient) => {
                  const lastAppt = patient.appointments[0] ?? null
                  const chip = lastAppt ? (STATUS_CHIP[lastAppt.status] ?? null) : null
                  return (
                    <TableRow key={patient.id} hover onClick={() => setSelectedPatient(patient)} sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: '#f8fafc' }, cursor: 'pointer' }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                        {patient.patientCode ?? '—'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, color: '#334155' }}>
                        {patient.firstName} {patient.lastName}
                      </TableCell>
                      <TableCell sx={{ color: '#334155' }}>
                        {lastAppt?.service?.name ?? '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#334155', whiteSpace: 'nowrap' }}>
                        {lastAppt
                          ? new Date(lastAppt.scheduledAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {chip ? (
                          <Chip label={chip.label} size='small' sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.72rem' }} />
                        ) : '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#334155', fontWeight: 600 }}>
                        {patient._count.appointments}
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
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          />
        </Box>
      </Box>

      <PatientRecordsDrawer
        patient={selectedPatient}
        onClose={() => setSelectedPatient(null)}
        stepUpGranted={stepUpGranted}
        setStepUpGranted={setStepUpGranted}
      />
    </SidebarInset>
  )
}
