'use client'

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import ServiceFormModal from './ServiceFormModal'
import DeleteServiceModal from './DeleteServiceModal'

const HEAD_CELLS = [
  { label: 'Service Name' },
  { label: 'Duration (min)', align: 'center' },
  { label: 'Default Price', align: 'right' },
  { label: 'Buffer (min)', align: 'center' },
  { label: 'Assigned Dentists' },
  { label: 'Actions', align: 'center' }
]

export default function ServicesPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [dentists, setDentists] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/services')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.services)
    } catch {
      showToast('Failed to load services', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const fetchDentists = useCallback(async () => {
    try {
      const res = await fetch('/api/services/dentists')
      if (!res.ok) return
      const data = await res.json()
      setDentists(data.dentists)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    fetchServices()
    fetchDentists()
  }, [fetchServices, fetchDentists])

  return (
    <SidebarInset>
      <PageHeader title='Services' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary'>
              Service Catalog
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              Manage dental services offered at this clinic
            </Typography>
          </Box>
          <Tooltip title='Add service'>
            <Box
              onClick={() => {
                setEditTarget(null)
                setFormOpen(true)
              }}
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
                userSelect: 'none'
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
            height: 'calc(100vh - 280px)' // add this
          }}
        >
          <TableContainer sx={{ height: '100%' }}>
            <Table stickyHeader sx={{ borderCollapse: 'collapse' }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {HEAD_CELLS.map((cell) => (
                    <TableCell
                      key={cell.label}
                      align={cell.align ?? 'left'}
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        color: '#64748b',
                        py: 1.5,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      {cell.label}
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
                      <Typography variant='body2' color='text.disabled'>
                        No services added yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {!loading &&
                  rows.map((row) => (
                    <TableRow key={row.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                      <TableCell
                        sx={{ fontWeight: 500, color: '#334155', border: '1px solid', borderColor: 'divider' }}
                      >
                        {row.name}
                      </TableCell>

                      <TableCell align='center' sx={{ color: '#334155', border: '1px solid', borderColor: 'divider' }}>
                        {row.duration}
                      </TableCell>

                      <TableCell align='right' sx={{ color: '#334155', border: '1px solid', borderColor: 'divider' }}>
                        {row.price !== null && row.price !== undefined ? (
                          `₱${Number(row.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                        ) : (
                          <Typography variant='body2' color='text.disabled'>
                            —
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align='center' sx={{ color: '#334155', border: '1px solid', borderColor: 'divider' }}>
                        {row.bufferTime}
                      </TableCell>

                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>
                        {row.dentists?.length ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {row.dentists.map((d) => (
                              <Chip
                                key={d.id}
                                label={`${d.user.firstName} ${d.user.lastName}`}
                                size='small'
                                sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 500, fontSize: '0.72rem' }}
                              />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant='body2' color='text.disabled'>
                            —
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align='center' sx={{ border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title='Edit'>
                            <IconButton
                              size='small'
                              onClick={() => {
                                setEditTarget(row)
                                setFormOpen(true)
                              }}
                              sx={{ cursor: 'pointer' }}
                            >
                              <EditOutlinedIcon fontSize='small' />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title='Delete'>
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
        </Box>
      </Box>

      <ServiceFormModal
        open={formOpen}
        service={editTarget}
        dentists={dentists}
        onClose={() => {
          setFormOpen(false)
          setEditTarget(null)
        }}
        onSuccess={() => {
          setFormOpen(false)
          setEditTarget(null)
          fetchServices()
        }}
      />

      <DeleteServiceModal
        open={!!deleteTarget}
        service={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => {
          setDeleteTarget(null)
          fetchServices()
        }}
      />
    </SidebarInset>
  )
}
