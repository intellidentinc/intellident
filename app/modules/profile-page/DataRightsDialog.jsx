'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'

const TYPE_OPTIONS = [
  { value: 'ACCESS',     label: 'Access — Request a copy of your personal data' },
  { value: 'CORRECTION', label: 'Correction — Request correction of inaccurate data' },
  { value: 'DELETION',   label: 'Deletion — Request deletion of your personal data' },
]

const STATUS_CHIP = {
  PENDING:   { label: 'Pending',   sx: { bgcolor: '#fef9c3', color: '#854d0e' } },
  IN_REVIEW: { label: 'In Review', sx: { bgcolor: '#dbeafe', color: '#1d4ed8' } },
  RESOLVED:  { label: 'Resolved',  sx: { bgcolor: '#dcfce7', color: '#15803d' } },
  REJECTED:  { label: 'Rejected',  sx: { bgcolor: '#fee2e2', color: '#b91c1c' } },
}

const TYPE_LABELS = { ACCESS: 'Access', CORRECTION: 'Correction', DELETION: 'Deletion' }

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DataRightsDialog({ open, onClose }) {
  const { showToast } = useToast()
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pastRequests, setPastRequests] = useState([])
  const [loadingPast, setLoadingPast] = useState(false)

  useEffect(() => {
    if (!open) return
    setType('')
    setDescription('')
    setLoadingPast(true)
    fetch('/api/data-requests?own=true&pageSize=10')
      .then((r) => r.json())
      .then((data) => setPastRequests(data.requests ?? []))
      .catch(() => {})
      .finally(() => setLoadingPast(false))
  }, [open])

  async function handleSubmit() {
    if (!type) {
      showToast('Please select a request type', 'warning')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/data-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, description }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error ?? 'Failed to submit request', 'error')
        return
      }
      showToast('Request submitted successfully', 'success')
      setType('')
      setDescription('')
      // Refresh past requests
      const refreshed = await fetch('/api/data-requests?own=true&pageSize=10').then((r) => r.json())
      setPastRequests(refreshed.requests ?? [])
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem', pb: 1 }}>
        Submit a Data Rights Request
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2.5 }}>
          Under the Philippine Data Privacy Act, you have the right to access, correct, or request deletion of your personal data.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant='caption' fontWeight={500} color='text.secondary' display='block' sx={{ mb: 0.5 }}>
              Request type <span style={{ color: '#E05C6A' }}>*</span>
            </Typography>
            <TextField
              select
              fullWidth
              size='small'
              value={type}
              onChange={(e) => setType(e.target.value)}
              slotProps={{ select: { displayEmpty: true } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            >
              <MenuItem value=''><em style={{ color: '#94a3b8' }}>Select type</em></MenuItem>
              {TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Box>
            <Typography variant='caption' fontWeight={500} color='text.secondary' display='block' sx={{ mb: 0.5 }}>
              Description (optional)
            </Typography>
            <TextField
              multiline
              rows={3}
              fullWidth
              size='small'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Describe your request in detail...'
              inputProps={{ maxLength: 2000 }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.875rem' } }}
            />
          </Box>
        </Box>

        {/* Past requests */}
        {(loadingPast || pastRequests.length > 0) && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant='subtitle2' fontWeight={600} color='text.primary' sx={{ mb: 1.5 }}>
              Previous Requests
            </Typography>
            {loadingPast ? (
              <Typography variant='body2' color='text.secondary'>Loading...</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {pastRequests.map((req) => {
                  const chip = STATUS_CHIP[req.status] ?? { label: req.status, sx: {} }
                  return (
                    <Box key={req.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid', borderColor: '#e2e8f0' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant='caption' fontWeight={600} color='text.primary'>
                            {TYPE_LABELS[req.type] ?? req.type}
                          </Typography>
                          <Chip label={chip.label} size='small' sx={{ ...chip.sx, fontWeight: 600, fontSize: '0.7rem', height: 18, borderRadius: 0.75 }} />
                        </Box>
                        <Typography variant='caption' color='text.secondary'>{formatDate(req.createdAt)}</Typography>
                      </Box>
                      {req.description && (
                        <Typography variant='caption' color='text.secondary' display='block'>
                          {req.description.length > 120 ? req.description.slice(0, 120) + '…' : req.description}
                        </Typography>
                      )}
                      {req.adminNotes && (
                        <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5, fontStyle: 'italic' }}>
                          Admin: {req.adminNotes}
                        </Typography>
                      )}
                    </Box>
                  )
                })}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button variant='outlined' onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant='contained' onClick={handleSubmit} loading={submitting}>Submit Request</Button>
      </DialogActions>
    </Dialog>
  )
}
