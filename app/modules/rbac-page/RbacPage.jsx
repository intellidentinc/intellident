'use client'

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import { DataGrid } from '@mui/x-data-grid'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useToast } from '@/app/providers/ToastProvider'
import EditRoleModal from './EditRoleModal'
import DeleteUserModal from './DeleteUserModal'

const ROLE_STYLES = {
  PATIENT: { bg: '#dbeafe', color: '#2563eb' },
  STAFF: { bg: '#dcfce7', color: '#16a34a' },
  ADMIN: { bg: '#fee2e2', color: '#dc2626' }
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
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })
  const [sortModel, setSortModel] = useState([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(paginationModel.page),
        pageSize: String(paginationModel.pageSize),
        search: debouncedSearch,
        sortField: sortModel[0]?.field ?? 'firstName',
        sortOrder: sortModel[0]?.sort ?? 'asc'
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
  }, [paginationModel, sortModel, debouncedSearch, showToast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const columns = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      valueGetter: (value, row) => `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim()
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 130,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => <RoleChip role={params.value} />
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: '100%' }}>
          <IconButton size='small' onClick={() => setEditTarget(params.row)}>
            <EditOutlinedIcon fontSize='small' />
          </IconButton>
          <IconButton size='small' onClick={() => setDeleteTarget(params.row)}>
            <DeleteOutlinedIcon fontSize='small' />
          </IconButton>
        </Box>
      )
    }
  ]

  return (
    <SidebarInset>
      <header className='flex h-14 items-center gap-3 border-b bg-white px-4'>
        <SidebarTrigger />
        <div className='h-5 w-px bg-gray-200' />
        <span className='font-semibold text-slate-700'>User Management</span>
      </header>

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant='h5' fontWeight={700} color='text.primary' sx={{ mb: 3 }}>
            Users
          </Typography>

          <TextField
            placeholder='Search by name or email...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size='small'
            sx={{ mb: 2, width: 320 }}
          />

          <DataGrid
            rows={rows}
            columns={columns}
            rowCount={rowCount}
            loading={loading}
            paginationMode='server'
            sortingMode='server'
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            autoHeight
          />
        </Paper>
      </Box>

      <EditRoleModal
        open={!!editTarget}
        user={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          setEditTarget(null)
          fetchUsers()
        }}
      />
      <DeleteUserModal
        open={!!deleteTarget}
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => {
          setDeleteTarget(null)
          fetchUsers()
        }}
      />
    </SidebarInset>
  )
}
