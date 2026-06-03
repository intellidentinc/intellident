'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { GavelOutlined } from '@mui/icons-material'

const STATUS_OPTIONS = [
  { value: 'PENDING',   label: 'Pending' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'RESOLVED',  label: 'Resolved' },
  { value: 'REJECTED',  label: 'Rejected' },
]

const TYPE_LABELS = { ACCESS: 'Access', CORRECTION: 'Correction', DELETION: 'Deletion' }

const STATUS_CHIP = {
  PENDING:   { label: 'Pending',    sx: { bgcolor: '#fef9c3', color: '#854d0e' } },
  IN_REVIEW: { label: 'In Review',  sx: { bgcolor: '#dbeafe', color: '#1d4ed8' } },
  RESOLVED:  { label: 'Resolved',   sx: { bgcolor: '#dcfce7', color: '#15803d' } },
  REJECTED:  { label: 'Rejected',   sx: { bgcolor: '#fee2e2', color: '#b91c1c' } },
}

export default function ReviewRequestModal({ open, dataRequest, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [status, setStatus] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !dataRequest) return
    setStatus(dataRequest.status ?? 'PENDING')
    setAdminNotes(dataRequest.adminNotes ?? '')
  }, [open, dataRequest])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/data-requests/${dataRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error ?? 'Failed to update', 'error')
        return
      }
      showToast('Request updated', 'success')
      onSuccess()
      onClose()
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!dataRequest) return null

  const chip = STATUS_CHIP[dataRequest.status] ?? STATUS_CHIP.PENDING

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
          <GavelOutlined sx={{ fontSize: 20, color: '#2563eb' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
              Review Data Request
            </Typography>
            <Chip label={chip.label} size='small' sx={{ ...chip.sx, fontWeight: 600, fontSize: '0.72rem', height: 20, borderRadius: 1 }} />
          </Box>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            {dataRequest.user?.firstName} {dataRequest.user?.lastName} &mdash; {TYPE_LABELS[dataRequest.type] ?? dataRequest.type}
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {dataRequest.description ? (
          <Box>
            <Typography variant='caption' fontWeight={500} color='text.secondary' display='block' sx={{ mb: 0.5 }}>
              Patient&apos;s description
            </Typography>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid', borderColor: '#e2e8f0' }}>
              <Typography variant='body2' color='text.primary' sx={{ whiteSpace: 'pre-wrap' }}>
                {dataRequest.description}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography variant='body2' color='text.secondary' fontStyle='italic'>No description provided.</Typography>
        )}

        <Box>
          <Typography variant='caption' fontWeight={500} color='text.secondary' display='block' sx={{ mb: 0.5 }}>
            Status
          </Typography>
          <TextField
            select
            fullWidth
            size='small'
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
        </Box>

        <Box>
          <Typography variant='caption' fontWeight={500} color='text.secondary' display='block' sx={{ mb: 0.5 }}>
            Admin notes (optional)
          </Typography>
          <TextField
            multiline
            rows={3}
            fullWidth
            size='small'
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder='Notes for the patient...'
            inputProps={{ maxLength: 2000 }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.875rem' } }}
          />
        </Box>
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant='contained' onClick={handleSave} loading={saving}>Save</Button>
      </Box>
    </Dialog>
  )
}
