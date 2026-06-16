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
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import PageContainer from '@/components/commons/PageContainer'
import EmptyState from '@/components/commons/EmptyState'
import { useToast } from '@/app/providers/ToastProvider'
import { Users } from 'lucide-react'
import dynamic from 'next/dynamic'
const AddPatientModal = dynamic(() => import('./AddPatientModal'))
const EditPatientModal = dynamic(() => import('./EditPatientModal'))
const DeletePatientModal = dynamic(() => import('./DeletePatientModal'))

const HEAD_CELLS = [
  { id: 'firstName', label: 'Name', sortable: true },
  { id: 'email', label: 'Email', sortable: false },
  { id: 'phone', label: 'Mobile Number', sortable: false },
  { id: 'actions', label: 'Actions', sortable: false, align: 'center' },
]

export default function PatientsPage({ initialRows = [], initialTotal = 0 }) {
  const { showToast } = useToast()
  const [rows, setRows] = useState(initialRows)
  const [rowCount, setRowCount] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState('firstName')
  const [sortOrder, setSortOrder] = useState('asc')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // The first page is server-rendered, so skip the redundant initial fetch.
  const seeded = useRef(true)

  const fetchPatients = useCallback(async () => {
    if (seeded.current) { seeded.current = false; return }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortField,
        sortOrder,
      })
      const res = await fetch(`/api/patients?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.patients)
      setRowCount(data.total)
    } catch {
      showToast('Failed to load patients', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, sortField, sortOrder, showToast])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
    setPage(0)
  }

  return (
    <SidebarInset>
      <PageHeader title='Patients' />

      <PageContainer
        title='Patients'
        subtitle='Manage patient records for this clinic'
        action={
          <Tooltip title='Register patient'>
            <Box
              onClick={() => setAddOpen(true)}
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
        }
      >
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
                    <TableCell colSpan={4} align='center' sx={{ py: 6 }}>
                      <CircularProgress size={28} sx={{ color: '#2563eb' }} />
                    </TableCell>
                  </TableRow>
                )}

                {!loading && rows.length === 0 && (
                  <TableRow sx={{ '&:hover': { bgcolor: 'transparent' } }}>
                    <TableCell colSpan={4} sx={{ border: 0 }}>
                      <EmptyState
                        icon={Users}
                        title='No patients yet'
                        description='Registered patients for this clinic will appear here.'
                      />
                    </TableCell>
                  </TableRow>
                )}

                {!loading && rows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: '#f8fafc' } }}
                  >
                    <TableCell sx={{ fontWeight: 500, color: '#334155' }}>
                      {`${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || '—'}
                    </TableCell>

                    <TableCell sx={{ color: '#334155' }}>
                      {row.email}
                    </TableCell>

                    <TableCell sx={{ color: '#334155' }}>
                      {row.phone || '—'}
                    </TableCell>

                    <TableCell align='center'>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title='Edit patient'>
                          <IconButton size='small' onClick={() => setEditTarget(row)} sx={{ cursor: 'pointer' }}>
                            <EditOutlinedIcon fontSize='small' />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title='Delete patient'>
                          <IconButton size='small' onClick={() => setDeleteTarget(row)} sx={{ cursor: 'pointer' }}>
                            <DeleteOutlinedIcon fontSize='small' />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
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
      </PageContainer>

      <AddPatientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => { setAddOpen(false); fetchPatients() }}
      />
      <EditPatientModal
        open={!!editTarget}
        patient={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => { setEditTarget(null); fetchPatients() }}
      />
      <DeletePatientModal
        open={!!deleteTarget}
        patient={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => { setDeleteTarget(null); fetchPatients() }}
      />
    </SidebarInset>
  )
}
