'use client'

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'
import { FileText, Eye, Building2, Phone, Mail, MapPin, CheckCircle, XCircle } from 'lucide-react'

const STATUS_FILTERS = [
  { value: 'PENDING',  label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL',      label: 'All' },
]

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
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: '0.72rem' }}
    />
  )
}

function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ mt: 0.25, flexShrink: 0 }}>
        <Icon size={14} color="#94a3b8" />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.primary" sx={{ mt: 0.25, lineHeight: 1.5 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  )
}

export default function ApplicationsTab() {
  const { showToast } = useToast()
  const [filter, setFilter] = useState('PENDING')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  // Detail dialog
  const [detailTarget, setDetailTarget] = useState(null)

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)

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

  async function handleApprove(id, e) {
    e?.stopPropagation()
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
      setDetailTarget(null)
      fetchApplications()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  function openReject(id, e) {
    e?.stopPropagation()
    setRejectTarget(id)
    setRejectNotes('')
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
      setDetailTarget(null)
      fetchApplications()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setRejectLoading(false)
    }
  }

  const pendingCount = applications.filter((a) => a.status === 'PENDING').length

  return (
    <Box sx={{ width: '100%' }}>
      {/* Filter strip */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', width: '100%' }}>
        {STATUS_FILTERS.map((f) => {
          const isActive = filter === f.value
          return (
            <Box
              key={f.value}
              component="button"
              onClick={() => setFilter(f.value)}
              sx={{
                border: '1px solid',
                borderColor: isActive ? '#2563eb' : 'divider',
                bgcolor: isActive ? '#eff6ff' : '#fff',
                color: isActive ? '#2563eb' : '#64748b',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.8rem',
                px: 2,
                py: 0.75,
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                '&:hover': {
                  borderColor: '#2563eb',
                  bgcolor: '#eff6ff',
                  color: '#2563eb',
                },
              }}
            >
              {f.label}
              {f.value === 'PENDING' && pendingCount > 0 && (
                <Box sx={{
                  bgcolor: '#2563eb', color: '#fff', fontSize: '0.65rem', fontWeight: 700,
                  borderRadius: '10px', px: 0.75, py: 0.1, lineHeight: 1.6, minWidth: 18, textAlign: 'center',
                }}>
                  {pendingCount}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>

      {/* Table card */}
      <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden', width: '100%' }}>
        <TableContainer>
          <Table sx={{ minWidth: 900, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', py: 1.5, borderBottom: '1px solid', borderColor: 'divider', width: '22%' }}>Applicant</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', py: 1.5, borderBottom: '1px solid', borderColor: 'divider', width: '16%' }}>Clinic Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', py: 1.5, borderBottom: '1px solid', borderColor: 'divider', width: '20%' }}>Business Contact</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', py: 1.5, borderBottom: '1px solid', borderColor: 'divider', width: '13%' }}>Submitted</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', py: 1.5, borderBottom: '1px solid', borderColor: 'divider', width: '11%' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b', py: 1.5, borderBottom: '1px solid', borderColor: 'divider', width: '18%' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} sx={{ color: '#2563eb' }} />
                  </TableCell>
                </TableRow>
              )}

              {!loading && applications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} color="#94a3b8" />
                      </Box>
                      <Typography variant="body2" color="text.disabled" fontWeight={500}>
                        No {filter !== 'ALL' ? filter.toLowerCase() : ''} applications
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}

              {!loading && applications.map((app) => (
                <TableRow
                  key={app.id}
                  hover
                  onClick={() => setDetailTarget(app)}
                  sx={{ cursor: 'pointer', '&:last-child td': { border: 0 }, '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  {/* Applicant */}
                  <TableCell sx={{ py: 1.75 }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      {app.contactPersonName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {app.contactPersonPhone}
                    </Typography>
                    {app.contactPersonEmail && (
                      <Typography variant="caption" color="text.secondary">
                        {app.contactPersonEmail}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Clinic Name */}
                  <TableCell sx={{ py: 1.75 }}>
                    <Typography variant="body2" color="text.primary">{app.clinicName}</Typography>
                    {app.status === 'APPROVED' && app.clinic && (
                      <Typography variant="caption" color="success.main" fontWeight={600}>
                        → {app.clinic.name}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Business Contact */}
                  <TableCell sx={{ py: 1.75 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{app.businessEmail}</Typography>
                    <Typography variant="caption" color="text.secondary">{app.businessPhone}</Typography>
                  </TableCell>

                  {/* Submitted */}
                  <TableCell sx={{ py: 1.75, whiteSpace: 'nowrap' }}>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(app.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </Typography>
                  </TableCell>

                  {/* Status */}
                  <TableCell sx={{ py: 1.75 }}>
                    <StatusChip status={app.status} />
                  </TableCell>

                  {/* Actions */}
                  <TableCell sx={{ py: 1.75 }} onClick={(e) => e.stopPropagation()}>
                    {app.status === 'PENDING' && (
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Tooltip title="Approve application">
                          <Box
                            component="button"
                            onClick={(e) => handleApprove(app.id, e)}
                            disabled={actionLoading === app.id}
                            sx={{
                              border: '1px solid #16a34a', bgcolor: 'transparent', color: '#16a34a',
                              fontWeight: 600, fontSize: '0.75rem', px: 1.25, py: 0.4,
                              borderRadius: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5,
                              '&:hover': { bgcolor: '#dcfce7' }, '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                              transition: 'background 0.15s',
                            }}
                          >
                            {actionLoading === app.id
                              ? <CircularProgress size={12} sx={{ color: '#16a34a' }} />
                              : <CheckCircle size={13} />
                            }
                            Approve
                          </Box>
                        </Tooltip>
                        <Tooltip title="Reject application">
                          <Box
                            component="button"
                            onClick={(e) => openReject(app.id, e)}
                            disabled={actionLoading === app.id}
                            sx={{
                              border: '1px solid #fca5a5', bgcolor: 'transparent', color: '#b91c1c',
                              fontWeight: 600, fontSize: '0.75rem', px: 1.25, py: 0.4,
                              borderRadius: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5,
                              '&:hover': { bgcolor: '#fee2e2', borderColor: '#b91c1c' }, '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                              transition: 'background 0.15s',
                            }}
                          >
                            <XCircle size={13} />
                            Reject
                          </Box>
                        </Tooltip>
                      </Box>
                    )}
                    {app.status === 'APPROVED' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckCircle size={13} color="#16a34a" />
                        <Typography variant="caption" color="success.main" fontWeight={600}>Approved</Typography>
                      </Box>
                    )}
                    {app.status === 'REJECTED' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <XCircle size={13} color="#b91c1c" />
                        <Typography variant="caption" color="error" fontWeight={600}>Rejected</Typography>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Application Detail Dialog */}
      <Dialog open={!!detailTarget} onClose={() => setDetailTarget(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {detailTarget && (
          <>
            <DialogTitle sx={{ pb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{detailTarget.clinicName}</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <StatusChip status={detailTarget.status} />
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'nowrap' }}>
                  {new Date(detailTarget.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                </Typography>
              </Box>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ py: 2.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                {/* Business info */}
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.25, display: 'block' }}>
                    Business Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 0.5 }}>
                    <DetailRow icon={Building2} label="Clinic Name" value={detailTarget.clinicName} />
                    <DetailRow icon={MapPin} label="Business Address" value={detailTarget.businessAddress} />
                    <DetailRow icon={Mail} label="Business Email" value={detailTarget.businessEmail} />
                    <DetailRow icon={Phone} label="Business Phone" value={detailTarget.businessPhone} />
                  </Box>
                </Box>

                <Divider />

                {/* Contact person */}
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.25, display: 'block' }}>
                    Contact Person
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 0.5 }}>
                    <DetailRow icon={Building2} label="Name" value={detailTarget.contactPersonName} />
                    <DetailRow icon={Phone} label="Phone" value={detailTarget.contactPersonPhone} />
                    <DetailRow icon={Mail} label="Email" value={detailTarget.contactPersonEmail} />
                  </Box>
                </Box>

                {detailTarget.message && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.25, display: 'block' }}>
                        Message
                      </Typography>
                      <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, fontStyle: 'italic' }}>
                          "{detailTarget.message}"
                        </Typography>
                      </Box>
                    </Box>
                  </>
                )}

                {detailTarget.status === 'REJECTED' && detailTarget.notes && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="#b91c1c" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.25, display: 'block' }}>
                        Rejection Reason
                      </Typography>
                      <Box sx={{ bgcolor: '#fff5f5', borderRadius: 2, p: 2, border: '1px solid #fecaca' }}>
                        <Typography variant="body2" color="#b91c1c" sx={{ lineHeight: 1.7 }}>
                          {detailTarget.notes}
                        </Typography>
                      </Box>
                    </Box>
                  </>
                )}

                {/* Proposed Services */}
                {detailTarget.proposedServices?.length > 0 && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.25, display: 'block' }}>
                        Proposed Services ({detailTarget.proposedServices.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        {detailTarget.proposedServices.map((svc, i) => (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={600} color="text.primary">{svc.name}</Typography>
                              {svc.description && (
                                <Typography variant="caption" color="text.secondary">{svc.description}</Typography>
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{svc.duration} min</Typography>
                            {svc.price != null && (
                              <Typography variant="caption" fontWeight={600} color="primary.main" sx={{ whiteSpace: 'nowrap' }}>₱{Number(svc.price).toLocaleString()}</Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </>
                )}

                {/* Documents */}
                {(detailTarget.birDocuments?.length > 0 || detailTarget.businessPermitDocs?.length > 0 || detailTarget.dtiSecDocs?.length > 0 || detailTarget.applicantIds?.length > 0 || detailTarget.prcLicenseDocs?.length > 0) && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.25, display: 'block' }}>
                        Submitted Documents
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {[
                          { key: 'birDocuments',      label: 'BIR Certificate of Registration', docs: detailTarget.birDocuments },
                          { key: 'businessPermitDocs', label: 'Business Permit',                  docs: detailTarget.businessPermitDocs },
                          { key: 'dtiSecDocs',         label: 'DTI / SEC Registration',           docs: detailTarget.dtiSecDocs },
                          { key: 'applicantIds',       label: 'Government-Issued ID',             docs: detailTarget.applicantIds },
                          { key: 'prcLicenseDocs',     label: 'PRC License',                      docs: detailTarget.prcLicenseDocs },
                        ].filter(g => g.docs?.length > 0).map(({ key, label, docs }) => (
                          <Box key={key}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.75, display: 'block' }}>
                              {label} ({docs.length})
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                              {docs.map((url, i) => (
                                <Box key={i} component="a" href={url} target="_blank" rel="noopener noreferrer"
                                  sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc', color: 'primary.main', textDecoration: 'none', fontSize: 13, '&:hover': { bgcolor: '#eff6ff', borderColor: '#2563eb' }, transition: 'all 0.15s' }}>
                                  <FileText size={14} />
                                  <Typography variant="body2" color="primary.main" fontWeight={500}>{label} {i + 1}</Typography>
                                  <Eye size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </>
                )}
              </Box>
            </DialogContent>
            <Divider />
            <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
              <Button variant="outlined" onClick={() => setDetailTarget(null)}>
                Close
              </Button>
              {detailTarget.status === 'PENDING' && (
                <>
                  <Button
                    variant="outlined"
                    disabled={actionLoading === detailTarget.id}
                    onClick={(e) => openReject(detailTarget.id, e)}
                    sx={{ borderColor: '#fca5a5', color: '#b91c1c', '&:hover': { bgcolor: '#fee2e2', borderColor: '#b91c1c' } }}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="contained"
                    loading={actionLoading === detailTarget.id}
                    onClick={(e) => handleApprove(detailTarget.id, e)}
                    sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                  >
                    Approve
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Reject Application</DialogTitle>
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
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
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
    </Box>
  )
}
