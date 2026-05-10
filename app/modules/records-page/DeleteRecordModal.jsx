'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { DeleteOutlined } from '@mui/icons-material'

export default function DeleteRecordModal({ open, patientId, record, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/records/${patientId}/${record.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      showToast('Record deleted', 'success')
      onSuccess()
    } catch {
      showToast('Failed to delete record', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth='xs'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 2, bgcolor: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, mt: 0.25,
          }}
        >
          <DeleteOutlined sx={{ fontSize: 20, color: '#dc2626' }} />
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>Delete Record</Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>This action cannot be undone</Typography>
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Typography variant='body2' color='text.secondary' lineHeight={1.7}>
          You are about to delete{' '}
          <Typography component='span' variant='body2' fontWeight={600} color='text.primary'>
            {record?.title}
          </Typography>
          . The encrypted notes will be permanently removed.
        </Typography>
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant='contained'
          onClick={handleDelete}
          loading={loading}
          sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
        >
          Delete record
        </Button>
      </Box>
    </Dialog>
  )
}
