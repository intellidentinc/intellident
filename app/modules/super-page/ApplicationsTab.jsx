'use client'

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'
import { FileText } from 'lucide-react'

const STATUS_FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL']

const STATUS_CHIP = {
  PENDING:  { label: 'Pending',  bg: '#fef9c3', color: '#854d0e' },
  APPROVED: { label: 'Approved', bg: '#dcfce7', color: '#15803d' },
  REJECTED: { label: 'Rejected', bg: '#fee2e2', color: '#b91c1c' },
}

function StatusChip({ status }) {
  const s = STATUS_CHIP[status] ?? { label: status, bg: '#f1f5f9', color: '#475569' }
  return (
    <Chip
      label={s.label}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: 11 }}
    />
  )
}

export default function ApplicationsTab() {
  const { showToast } = useToast()
  const [filter, setFilter] = useState('PENDING')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  // Reject dialog
  const [rejectTarget,  setRejectTarget]  = useState(null)
  const [rejectNotes,   setRejectNotes]   = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)

  // Documents dialog
  const [docsTarget, setDocsTarget] = useState(null)

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    try {
      const qs = filter !== 'ALL' ? `?status=${filter}` : ''
      const res = await fetch(`/api/super/clinic-applications${qs}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setApplications(data)
    } catch {
      showToast('Failed to load applications', 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, showToast])

  useEffect(() => { fetchApplications() }, [fetchApplications])

  async function handleApprove(id) {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/super/clinic-applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to approve')
      }
      showToast('Clinic application approved', 'success')
      fetchApplications()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return
    setRejectLoading(true)
    try {
      const res = await fetch(`/api/super/clinic-applications/${rejectTarget}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', notes: rejectNotes.trim() || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to reject')
      }
      showToast('Application rejected', 'success')
      setRejectTarget(null)
      setRejectNotes('')
      fetchApplications()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setRejectLoading(false)
    }
  }

  return (
    <>
      {/* Status filter tabs */}
      <Tabs
        value={filter}
        onChange={(_, v) => setFilter(v)}
        sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        {STATUS_FILTERS.map((f) => (
          <Tab key={f} label={f.charAt(0) + f.slice(1).toLowerCase()} value={f} />
        ))}
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : applications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body2" color="text.secondary">No applications found.</Typography>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Contact Person', 'Clinic Name', 'Business Email', 'Phone', 'Submitted', 'Status', 'Docs', 'Actions'].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id} hover>
                  <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" fontWeight={600}>{app.contactPersonName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{app.contactPersonPhone}</Typography>
                    {app.contactPersonEmail && (
                      <Typography variant="caption" color="text.secondary">{app.contactPersonEmail}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{app.clinicName}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{app.businessEmail}</TableCell>
                  <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap' }}>{app.businessPhone}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {new Date(app.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell><StatusChip status={app.status} /></TableCell>
                  <TableCell>
                    {(app.birDocuments?.length > 0 || app.applicantIds?.length > 0) && (
                      <IconButton size="small" title="View documents" onClick={() => setDocsTarget(app)} sx={{ color: 'primary.main' }}>
                        <FileText size={16} />
                      </IconButton>
                    )}
                  </TableCell>
                  <TableCell>
                    {app.status === 'PENDING' && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          loading={actionLoading === app.id}
                          onClick={() => handleApprove(app.id)}
                          sx={{ borderColor: '#15803d', color: '#15803d', '&:hover': { bgcolor: '#dcfce7', borderColor: '#15803d' }, fontSize: 12, py: 0.25 }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={actionLoading === app.id}
                          onClick={() => { setRejectTarget(app.id); setRejectNotes('') }}
                          sx={{ borderColor: '#b91c1c', color: '#b91c1c', '&:hover': { bgcolor: '#fee2e2', borderColor: '#b91c1c' }, fontSize: 12, py: 0.25 }}
                        >
                          Reject
                        </Button>
                      </Box>
                    )}
                    {app.status === 'APPROVED' && app.clinic && (
                      <Typography variant="caption" color="success.main" fontWeight={600}>
                        {app.clinic.name}
                      </Typography>
                    )}
                    {app.status === 'REJECTED' && app.notes && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {app.notes}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Reject Application</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide an optional reason for rejection. This will be shared with the applicant.
          </Typography>
          <Input
            id="rejectNotes"
            label="Reason (optional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            multiline
            rows={3}
            placeholder="e.g. Incomplete business documentation"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setRejectTarget(null)} disabled={rejectLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            loading={rejectLoading}
            onClick={handleRejectConfirm}
            sx={{ bgcolor: '#b91c1c', '&:hover': { bgcolor: '#991b1b' } }}
          >
            Confirm Rejection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Documents dialog */}
      <Dialog open={!!docsTarget} onClose={() => setDocsTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Submitted Documents</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {docsTarget && (
            <>
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  BIR Documents
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {docsTarget.birDocuments?.length > 0 ? docsTarget.birDocuments.map((url, i) => (
                    <Box key={i} component="a" href={url} target="_blank" rel="noopener noreferrer"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc', color: 'primary.main', textDecoration: 'none', fontSize: 13, '&:hover': { bgcolor: '#eff6ff' } }}>
                      <FileText size={14} />
                      BIR Document {i + 1}
                    </Box>
                  )) : (
                    <Typography variant="caption" color="text.secondary">No BIR documents uploaded.</Typography>
                  )}
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Owner / Applicant IDs
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {docsTarget.applicantIds?.length > 0 ? docsTarget.applicantIds.map((url, i) => (
                    <Box key={i} component="a" href={url} target="_blank" rel="noopener noreferrer"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc', color: 'primary.main', textDecoration: 'none', fontSize: 13, '&:hover': { bgcolor: '#eff6ff' } }}>
                      <FileText size={14} />
                      ID Document {i + 1}
                    </Box>
                  )) : (
                    <Typography variant="caption" color="text.secondary">No ID documents uploaded.</Typography>
                  )}
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setDocsTarget(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
