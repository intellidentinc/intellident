'use client'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { X, Download } from 'lucide-react'
import Button from '@/components/commons/Button'

export default function ReceiptPreviewDialog({ open, onClose, blobUrl, onDownload }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='md'
      fullWidth
      slotProps={{ paper: { sx: { height: '90vh', borderRadius: 2 } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        Receipt Preview
        <IconButton size='small' onClick={onClose}>
          <X size={16} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', flex: '1 1 auto', overflow: 'hidden', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        {blobUrl ? (
          <Box component='iframe' src={blobUrl} title='Receipt preview' width='100%' height='100%' sx={{ border: 0, display: 'block' }} />
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant='outlined' size='small' onClick={onClose} sx={{ fontSize: '0.8rem' }}>
          Close
        </Button>
        <Button
          variant='contained'
          size='small'
          startIcon={<Download size={14} />}
          onClick={onDownload}
          disabled={!blobUrl}
          sx={{ fontSize: '0.8rem' }}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  )
}
