'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import { ArticleOutlined, ShieldOutlined, LockOutlined } from '@mui/icons-material'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { useCrypto } from '@/app/providers/CryptoProvider'
import { decryptData, toBase64 } from '@/lib/crypto'
import dayjs from 'dayjs'

const STATUS_CHIP = {
  ACTIVE:   { label: 'Active',   bg: '#dcfce7', color: '#15803d' },
  ARCHIVED: { label: 'Archived', bg: '#f1f5f9', color: '#475569' },
}

export default function RecordViewModal({ open, record, onClose }) {
  const router = useRouter()
  const { showToast } = useToast()
  const { masterKey } = useCrypto()

  const [notes, setNotes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tampered, setTampered] = useState(false)
  const [keyMissing, setKeyMissing] = useState(false)

  useEffect(() => {
    if (!open || !record) return
    setNotes(null)
    setTampered(false)
    setKeyMissing(false)

    async function fetchAndDecrypt() {
      if (!masterKey) {
        setKeyMissing(true)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/patient/records/${record.id}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const { encryptedData, dataIv, contentHash, patientId } = data.record

        if (!encryptedData || !dataIv) {
          setNotes('')
          return
        }

        let plaintext
        try {
          plaintext = await decryptData(masterKey, encryptedData, dataIv, patientId)
        } catch {
          showToast('Could not decrypt this record. It may have been created before encryption was enabled.', 'warning')
          setNotes('')
          return
        }

        // Tamper detection
        if (contentHash) {
          const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plaintext))
          const recomputed = toBase64(hashBuf)
          if (recomputed !== contentHash) setTampered(true)
        }

        setNotes(plaintext)
      } catch {
        showToast('Failed to load record', 'error')
        onClose()
      } finally {
        setLoading(false)
      }
    }

    fetchAndDecrypt()
  }, [open, record]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!record) return null

  const chip = STATUS_CHIP[record.status] ?? STATUS_CHIP.ACTIVE

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 2, bgcolor: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, mt: 0.25,
          }}
        >
          <ArticleOutlined sx={{ fontSize: 20, color: '#2563eb' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant='subtitle1' fontWeight={600} color='text.primary' noWrap>
              {record.title}
            </Typography>
            <Chip
              label={chip.label}
              size='small'
              sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.7rem' }}
            />
          </Box>
          <Typography variant='caption' color='text.secondary'>
            Added {dayjs(record.createdAt).format('MMM D, YYYY')}
            {record.updatedAt !== record.createdAt && ` · Updated ${dayjs(record.updatedAt).format('MMM D, YYYY')}`}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, minHeight: 120 }}>
        {keyMissing ? (
          <Box
            sx={{
              p: 2, borderRadius: 2, bgcolor: '#fef9c3',
              border: '1px solid', borderColor: '#fcd34d',
              display: 'flex', flexDirection: 'column', gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LockOutlined sx={{ fontSize: 18, color: '#92400e' }} />
              <Typography variant='body2' fontWeight={600} sx={{ color: '#92400e' }}>
                Decryption key unavailable
              </Typography>
            </Box>
            <Typography variant='body2' color='text.secondary'>
              Your notes are end-to-end encrypted and can only be decrypted during an active login session. Sign in again to view them.
            </Typography>
            <Box>
              <Button variant='contained' size='small' onClick={() => router.push('/sign-in')}>
                Sign in again
              </Button>
            </Box>
          </Box>
        ) : loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
            <CircularProgress size={16} sx={{ color: '#2563eb' }} />
            <Typography variant='body2' color='text.secondary'>Decrypting notes…</Typography>
          </Box>
        ) : tampered ? (
          <Box
            sx={{
              p: 2, borderRadius: 2, bgcolor: '#fef2f2',
              border: '1px solid', borderColor: '#fecaca',
            }}
          >
            <Typography variant='body2' color='error.main' fontWeight={600} gutterBottom>
              Integrity check failed
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              This record's notes may have been modified outside the application. Please contact your dentist.
            </Typography>
          </Box>
        ) : notes === '' ? (
          <Typography variant='body2' color='text.disabled' sx={{ fontStyle: 'italic' }}>
            No clinical notes added for this record.
          </Typography>
        ) : notes !== null ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <ShieldOutlined sx={{ fontSize: 14, color: '#15803d' }} />
              <Typography variant='caption' sx={{ color: '#15803d', fontWeight: 600 }}>
                End-to-end encrypted · decrypted locally
              </Typography>
            </Box>
            <Typography
              variant='body2'
              color='text.primary'
              sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
            >
              {notes}
            </Typography>
          </Box>
        ) : null}
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant='outlined' onClick={onClose}>Close</Button>
      </Box>
    </Dialog>
  )
}
