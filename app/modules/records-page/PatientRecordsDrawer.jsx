'use client'

import { useState, useEffect, useCallback } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import { X, Plus, Pencil, Trash2, FileText, Paperclip } from 'lucide-react'
import Button from '@/components/commons/Button'
import RecordFormModal from './RecordFormModal'
import { useToast } from '@/app/providers/ToastProvider'
import dayjs from 'dayjs'

const STATUS_CHIP = {
  ACTIVE:   { label: 'Active',   bg: '#dcfce7', color: '#15803d' },
  ARCHIVED: { label: 'Archived', bg: '#f1f5f9', color: '#475569' },
}

export default function PatientRecordsDrawer({ patient, onClose }) {
  const { showToast } = useToast()
  const open = !!patient

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  // Form modal state
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // null = create, object = edit

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadRecords = useCallback(() => {
    if (!patient) return
    setLoading(true)
    fetch(`/api/records/${patient.id}`)
      .then((r) => r.json())
      .then((data) => setRecords(data.records ?? []))
      .catch(() => showToast('Failed to load records', 'error'))
      .finally(() => setLoading(false))
  }, [patient]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (patient) loadRecords()
    else setRecords([])
  }, [patient]) // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(rec) {
    setEditTarget(rec)
    setFormOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/records/${patient.id}/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Failed to delete record', 'error')
        return
      }
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      showToast('Record deleted', 'success')
      setDeleteTarget(null)
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Drawer
        anchor='right'
        open={open}
        onClose={onClose}
        slotProps={{ paper: { sx: { width: { xs: '100vw', sm: 480 }, p: 0 } } }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box>
            <Typography variant='subtitle1' fontWeight={700} color='text.primary'>
              {patient ? `${patient.firstName} ${patient.lastName}` : ''}
            </Typography>
            {patient?.patientCode && (
              <Typography variant='caption' color='text.secondary' sx={{ fontFamily: 'monospace' }}>
                {patient.patientCode}
              </Typography>
            )}
          </Box>
          <IconButton size='small' onClick={onClose}>
            <X size={18} />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant='body2' fontWeight={600} color='text.primary'>
              Clinical Records ({records.length})
            </Typography>
            <Button variant='contained' size='small' onClick={openCreate} sx={{ gap: 0.5 }}>
              <Plus size={14} /> Add Record
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[1, 2, 3].map((n) => <Skeleton key={n} variant='rounded' height={80} />)}
            </Box>
          ) : records.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <FileText size={36} color='#94a3b8' style={{ marginBottom: 8 }} />
              <Typography variant='body2' color='text.secondary'>No records yet</Typography>
              <Typography variant='caption' color='text.disabled'>Click "Add Record" to create the first one</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {records.map((rec) => {
                const chip = STATUS_CHIP[rec.status] ?? STATUS_CHIP.ACTIVE
                return (
                  <Box
                    key={rec.id}
                    sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant='body2' fontWeight={600}>{rec.title}</Typography>
                          <Chip label={chip.label} size='small' sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.7rem' }} />
                          {rec._count?.attachments > 0 && (
                            <Chip
                              icon={<Paperclip size={10} />}
                              label={rec._count.attachments}
                              size='small'
                              sx={{ bgcolor: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: '0.7rem', '& .MuiChip-icon': { color: '#2563eb' } }}
                            />
                          )}
                        </Box>
                        <Typography variant='caption' color='text.disabled'>
                          {dayjs(rec.createdAt).format('MMM D, YYYY')}
                          {rec.updatedAt !== rec.createdAt && ` · Updated ${dayjs(rec.updatedAt).format('MMM D, YYYY')}`}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        <Tooltip title='Edit'>
                          <IconButton size='small' onClick={() => openEdit(rec)}>
                            <Pencil size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title='Delete'>
                          <IconButton size='small' onClick={() => setDeleteTarget(rec)} sx={{ color: 'error.main' }}>
                            <Trash2 size={14} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* E2EE-aware Add / Edit Modal */}
      {patient && (
        <RecordFormModal
          open={formOpen}
          patientId={patient.id}
          record={editTarget}
          onClose={() => setFormOpen(false)}
          onSuccess={loadRecords}
        />
      )}

      {/* Delete Confirm Modal */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth='xs' fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Record</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary'>
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant='outlined' onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button variant='contained' loading={deleting} onClick={handleDelete} sx={{ bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
