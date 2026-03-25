'use client'

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
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
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import EditRoleModal from './EditRoleModal'
import DeleteUserModal from './DeleteUserModal'
import AddUserModal from './AddUserModal'

const HEAD_CELLS = [
  { id: 'firstName', label: 'Name', sortable: true },
  { id: 'email', label: 'Email', sortable: true },
  { id: 'role', label: 'Role', sortable: false, align: 'center' },
  { id: 'actions', label: 'Actions', sortable: false, align: 'center' },
]

const ROLE_STYLES = {
  PATIENT:      { bg: '#dbeafe', color: '#2563eb' },
  RECEPTIONIST: { bg: '#dcfce7', color: '#16a34a' },
  DENTIST:      { bg: '#ede9fe', color: '#7c3aed' },
  ADMIN:        { bg: '#fee2e2', color: '#dc2626' },
}

function RoleChip({ role }) {
  const styles = ROLE_STYLES[role] ?? { bg: '#f1f5f9', color: '#475569' }
  return (
    <Chip
      label={role}
      size='small'
      sx={{ bgcolor: styles.bg, color: styles.color, fontWeight: 600, fontSize: '0.75rem' }}
    />
  )
}

export default function RbacPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState('firstName')
  const [sortOrder, setSortOrder] = useState('asc')
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortField,
        sortOrder,
      })
      const res = await fetch(`/api/users?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.users)
      setRowCount(data.total)
    } catch {
      showToast('Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, sortField, sortOrder, showToast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

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
      <PageHeader title='User Management' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary'>
              Users
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              Manage user roles and accounts for this clinic
            </Typography>
          </Box>
          <Tooltip title='Add user'>
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
                  <TableRow>
                    <TableCell colSpan={4} align='center' sx={{ py: 6 }}>
                      <Typography variant='body2' color='text.disabled'>
                        No users found
                      </Typography>
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

                    <TableCell align='center'>
                      <RoleChip role={row.role} />
                    </TableCell>

                    <TableCell align='center'>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title='Edit role'>
                          <IconButton size='small' onClick={() => setEditTarget(row)} sx={{ cursor: 'pointer' }}>
                            <EditOutlinedIcon fontSize='small' />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title='Delete user'>
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
      </Box>

      <EditRoleModal
        open={!!editTarget}
        user={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => { setEditTarget(null); fetchUsers() }}
      />
      <DeleteUserModal
        open={!!deleteTarget}
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => { setDeleteTarget(null); fetchUsers() }}
      />
      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => { setAddOpen(false); fetchUsers() }}
      />
    </SidebarInset>
  )
}
