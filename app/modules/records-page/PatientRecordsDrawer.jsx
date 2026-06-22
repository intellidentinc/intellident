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
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { X, Plus, Pencil, Trash2, FileText, Paperclip, CalendarX } from 'lucide-react'
import Button from '@/components/commons/Button'
import RecordFormModal from './RecordFormModal'
import OtpStepUpModal from '@/components/commons/OtpStepUpModal'
import UnlockRecordsModal from '@/components/commons/UnlockRecordsModal'
import { useToast } from '@/app/providers/ToastProvider'
import { useCrypto } from '@/app/providers/CryptoProvider'
import dayjs from 'dayjs'

const RECORD_STATUS_CHIP = {
  ACTIVE:   { label: 'Active',   bg: '#dcfce7', color: '#15803d' },
  ARCHIVED: { label: 'Archived', bg: '#f1f5f9', color: '#475569' },
}

const VISIT_STATUS_CHIP = {
  PENDING:     { label: 'Pending',     bg: '#fef9c3', color: '#854d0e' },
  CONFIRMED:   { label: 'Confirmed',   bg: '#dbeafe', color: '#1d4ed8' },
  COMPLETED:   { label: 'Completed',   bg: '#dcfce7', color: '#15803d' },
  CANCELLED:   { label: 'Cancelled',   bg: '#fee2e2', color: '#b91c1c' },
  NO_SHOW:     { label: 'No Show',     bg: '#f1f5f9', color: '#475569' },
  RESCHEDULED: { label: 'Rescheduled', bg: '#ede9fe', color: '#7c3aed' },
}

export default function PatientRecordsDrawer({ patient, onClose, stepUpGranted, setStepUpGranted }) {
  const { showToast } = useToast()
  const { privateKey } = useCrypto()

  const [stepUpOpen, setStepUpOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)

  const [tab, setTab] = useState(0)

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  const [visits, setVisits] = useState([])
  const [visitsLoading, setVisitsLoading] = useState(false)
  const [visitsFetched, setVisitsFetched] = useState(false)

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
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          if (data.requiresStepUp) {
            setStepUpGranted(false)
            setStepUpOpen(true)
          } else {
            showToast('Failed to load records', 'error')
          }
          return
        }
        const data = await r.json()
        setRecords(data.records ?? [])
      })
      .catch(() => showToast('Failed to load records', 'error'))
      .finally(() => setLoading(false))
  }, [patient]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadVisits = useCallback(() => {
    if (!patient) return
    setVisitsLoading(true)
    fetch(`/api/records/${patient.id}/visits`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          if (data.requiresStepUp) {
            setStepUpGranted(false)
            setStepUpOpen(true)
          } else {
            showToast('Failed to load visit history', 'error')
          }
          return
        }
        const data = await r.json()
        setVisits(data.visits ?? [])
        setVisitsFetched(true)
      })
      .catch(() => showToast('Failed to load visit history', 'error'))
      .finally(() => setVisitsLoading(false))
  }, [patient]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabChange(_, newTab) {
    setTab(newTab)
    if (newTab === 1 && !visitsFetched && !visitsLoading) loadVisits()
  }

  useEffect(() => {
    if (!patient) {
      setRecords([])
      setVisits([])
      setVisitsFetched(false)
      setTab(0)
      return
    }
    if (!stepUpGranted) {
      setStepUpOpen(true)
    }
  }, [patient]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stepUpGranted && patient) loadRecords()
  }, [stepUpGranted, patient]) // eslint-disable-line react-hooks/exhaustive-deps

  // The E2EE keys live only in memory and are lost on a page reload. Once a patient
  // is selected and step-up is granted, prompt for a password re-unlock if the keys
  // are missing so record decryption works without a looping full re-login.
  useEffect(() => {
    if (patient && stepUpGranted && !privateKey) setUnlockOpen(true)
  }, [patient, stepUpGranted, privateKey])

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
      <OtpStepUpModal
        open={stepUpOpen}
        onClose={() => { setStepUpOpen(false); onClose() }}
        onSuccess={() => { setStepUpOpen(false); setStepUpGranted(true) }}
        description='Viewing patient records requires identity verification.'
      />

      <UnlockRecordsModal
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => setUnlockOpen(false)}
      />

      <Drawer
        anchor='right'
        open={!!patient && stepUpGranted && !stepUpOpen}
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

        {/* Tabs */}
        <Tabs value={tab} onChange={handleTabChange} sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider', minHeight: 42 }} TabIndicatorProps={{ style: { backgroundColor: '#2563eb' } }}>
          <Tab label='Clinical Records' sx={{ fontSize: '0.8rem', fontWeight: 600, minHeight: 42, textTransform: 'none', color: tab === 0 ? '#2563eb' : 'text.secondary' }} />
          <Tab label='Visit History' sx={{ fontSize: '0.8rem', fontWeight: 600, minHeight: 42, textTransform: 'none', color: tab === 1 ? '#2563eb' : 'text.secondary' }} />
        </Tabs>

        {/* Body */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>

          {/* ── Tab 0: Clinical Records ── */}
          {tab === 0 && (
            <>
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
                    const chip = RECORD_STATUS_CHIP[rec.status] ?? RECORD_STATUS_CHIP.ACTIVE
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
            </>
          )}

          {/* ── Tab 1: Visit History ── */}
          {tab === 1 && (
            <>
              <Typography variant='body2' fontWeight={600} color='text.primary' sx={{ mb: 2 }}>
                Visit History ({visits.length})
              </Typography>

              {visitsLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {[1, 2, 3].map((n) => <Skeleton key={n} variant='rounded' height={80} />)}
                </Box>
              ) : visits.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <CalendarX size={36} color='#94a3b8' style={{ marginBottom: 8 }} />
                  <Typography variant='body2' color='text.secondary'>No visits yet</Typography>
                  <Typography variant='caption' color='text.disabled'>Appointments with this patient will appear here</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {visits.map((visit) => {
                    const chip = VISIT_STATUS_CHIP[visit.status] ?? VISIT_STATUS_CHIP.CONFIRMED
                    return (
                      <Box
                        key={visit.id}
                        sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                          <Typography variant='body2' fontWeight={600} sx={{ flex: 1, minWidth: 0 }}>
                            {visit.service?.name ?? 'Service'}
                          </Typography>
                          <Chip label={chip.label} size='small' sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.7rem', flexShrink: 0 }} />
                        </Box>
                        <Typography variant='caption' color='text.secondary' display='block'>
                          {dayjs(visit.scheduledAt).format('MMM D, YYYY · h:mm A')}
                        </Typography>
                        {visit.appointmentCode && (
                          <Typography variant='caption' color='text.disabled' display='block' sx={{ fontFamily: 'monospace', mt: 0.25 }}>
                            {visit.appointmentCode}
                          </Typography>
                        )}
                        {visit.notes && (
                          <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.75, fontStyle: 'italic' }}>
                            {visit.notes}
                          </Typography>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              )}
            </>
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
          onRequiresUnlock={() => setUnlockOpen(true)}
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
