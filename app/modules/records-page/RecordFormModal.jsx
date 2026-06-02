'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'
import { useCrypto } from '@/app/providers/CryptoProvider'
import { encryptData, decryptData, toBase64 } from '@/lib/crypto'
import {
  ArticleOutlined,
  LockOutlined,
  AttachFileOutlined,
  DeleteOutlined,
  InsertDriveFileOutlined,
  PictureAsPdfOutlined,
  ImageOutlined,
} from '@mui/icons-material'

const EMPTY_FORM = { title: '', notes: '', status: 'ACTIVE' }
const EMPTY_ERRORS = { title: '', notes: '' }

function FileTypeIcon({ mimeType }) {
  if (mimeType === 'application/pdf') return <PictureAsPdfOutlined sx={{ fontSize: 16, color: '#dc2626' }} />
  if (mimeType?.startsWith('image/')) return <ImageOutlined sx={{ fontSize: 16, color: '#2563eb' }} />
  return <InsertDriveFileOutlined sx={{ fontSize: 16, color: '#64748b' }} />
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function RecordFormModal({ open, patientId, record, onClose, onSuccess }) {
  const router = useRouter()
  const { showToast } = useToast()
  const { masterKey } = useCrypto()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState(EMPTY_ERRORS)
  const [loading, setLoading] = useState(false)
  const [decrypting, setDecrypting] = useState(false)
  const [keyMissing, setKeyMissing] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [pendingFiles, setPendingFiles] = useState([])
  const [deletingId, setDeletingId] = useState(null)

  const isEdit = !!record

  useEffect(() => {
    if (!open || !record) return
    setKeyMissing(false)

    async function fetchAndDecrypt() {
      if (!masterKey) {
        setKeyMissing(true)
        return
      }
      setDecrypting(true)
      try {
        const res = await fetch(`/api/records/${patientId}/${record.id}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const { encryptedData, dataIv, contentHash, title, status, attachments: atts } = data.record

        let notes = ''
        try {
          notes = await decryptData(masterKey, encryptedData, dataIv)
        } catch {
          showToast('Failed to decrypt record. The data may be corrupted.', 'error')
          onClose()
          return
        }

        const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(notes))
        const recomputed = toBase64(hashBuf)
        if (recomputed !== contentHash) {
          showToast('Record may have been tampered with', 'warning')
        }

        setForm({ title, notes, status: status ?? 'ACTIVE' })
        setAttachments(atts ?? [])
      } catch {
        showToast('Failed to load record', 'error')
        onClose()
      } finally {
        setDecrypting(false)
      }
    }

    fetchAndDecrypt()
  }, [open, record]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  function validate() {
    const next = { ...EMPTY_ERRORS }
    let valid = true
    if (!form.title.trim()) { next.title = 'Title is required'; valid = false }
    if (form.title.trim().length > 200) { next.title = 'Title must be 200 characters or fewer'; valid = false }
    setErrors(next)
    return valid
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const valid = files.filter((f) => {
      if (f.size > 5 * 1024 * 1024) {
        showToast(`${f.name} exceeds the 5 MB limit`, 'error')
        return false
      }
      return true
    })
    setPendingFiles((prev) => [...prev, ...valid])
    e.target.value = ''
  }

  function removePending(index) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function deleteAttachment(attachmentId) {
    setDeletingId(attachmentId)
    try {
      const res = await fetch(`/api/records/${patientId}/${record.id}/attachments/${attachmentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
    } catch {
      showToast('Failed to delete attachment', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function uploadPendingFiles(savedRecordId) {
    for (const file of pendingFiles) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch(`/api/records/${patientId}/${savedRecordId}/attachments`, { method: 'POST', body: fd })
        if (!res.ok) {
          const data = await res.json()
          showToast(`Failed to upload ${file.name}: ${data.error ?? 'Unknown error'}`, 'error')
        }
      } catch {
        showToast(`Failed to upload ${file.name}`, 'error')
      }
    }
  }

  async function handleSubmit() {
    if (!validate()) return
    if (!masterKey) {
      setKeyMissing(true)
      return
    }
    setLoading(true)
    try {
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(form.notes))
      const contentHash = toBase64(hashBuf)
      const { ciphertext: encryptedData, iv: dataIv } = await encryptData(masterKey, form.notes)

      const body = { title: form.title.trim(), encryptedData, dataIv, contentHash }
      if (isEdit) body.status = form.status

      const url = isEdit ? `/api/records/${patientId}/${record.id}` : `/api/records/${patientId}`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to save record', 'error')
        return
      }

      const saved = await res.json()
      const savedId = isEdit ? record.id : saved.id

      if (pendingFiles.length > 0) {
        await uploadPendingFiles(savedId)
      }

      showToast(isEdit ? 'Record updated' : 'Record created', 'success')
      handleClose()
      onSuccess()
    } catch {
      showToast('Failed to save record', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading || decrypting) return
    setForm(EMPTY_FORM)
    setErrors(EMPTY_ERRORS)
    setKeyMissing(false)
    setAttachments([])
    setPendingFiles([])
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            {isEdit ? 'Edit Record' : 'Add Record'}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            Notes are encrypted and stored securely
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {keyMissing && (
          <Box
            sx={{
              p: 2, borderRadius: 2, bgcolor: '#fef9c3',
              border: '1px solid', borderColor: '#fcd34d',
              display: 'flex', flexDirection: 'column', gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LockOutlined sx={{ fontSize: 16, color: '#92400e' }} />
              <Typography variant='body2' fontWeight={600} sx={{ color: '#92400e' }}>
                Decryption key unavailable
              </Typography>
            </Box>
            <Typography variant='caption' color='text.secondary'>
              Notes are end-to-end encrypted and can only be accessed during an active login session. Sign in again to continue.
            </Typography>
            <Box>
              <Button variant='contained' size='small' onClick={() => router.push('/sign-in')}>
                Sign in again
              </Button>
            </Box>
          </Box>
        )}
        <Input
          id='record-title'
          label='Title'
          value={form.title}
          onChange={handleChange('title')}
          placeholder='e.g. Initial Examination'
          error={!!errors.title}
          helperText={errors.title}
          required
        />

        {/* Notes field */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant='body2' fontWeight={500} color='text.primary' component='label' htmlFor='record-notes'>
              Clinical Notes
            </Typography>
            {decrypting && <CircularProgress size={12} sx={{ color: '#2563eb' }} />}
          </Box>
          <TextField
            id='record-notes'
            multiline
            rows={5}
            fullWidth
            value={form.notes}
            onChange={handleChange('notes')}
            placeholder='Enter clinical observations, diagnosis, treatment details...'
            disabled={decrypting}
            size='small'
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                fontSize: '0.875rem',
              },
            }}
          />
        </Box>

        {/* Status — edit mode only */}
        {isEdit && (
          <Box>
            <FormControl fullWidth size='small'>
              <FormLabel sx={{ mb: 0.5, fontSize: '0.875rem', fontWeight: 500, color: 'text.primary' }}>
                Status
              </FormLabel>
              <Select
                value={form.status}
                onChange={handleChange('status')}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value='ACTIVE'>Active</MenuItem>
                <MenuItem value='ARCHIVED'>Archived</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Attachments */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant='body2' fontWeight={500} color='text.primary'>
              Attachments
            </Typography>
            <Button
              variant='outlined'
              size='small'
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || decrypting}
              sx={{ minWidth: 'auto', px: 1.5, py: 0.5, fontSize: '0.75rem' }}
            >
              <AttachFileOutlined sx={{ fontSize: 14, mr: 0.5 }} />
              Add file
            </Button>
            <input
              ref={fileInputRef}
              type='file'
              multiple
              accept='.jpg,.jpeg,.png,.pdf'
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </Box>

          {/* Existing attachments (edit mode) */}
          {attachments.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: pendingFiles.length > 0 ? 1 : 0 }}>
              {attachments.map((att) => (
                <Box
                  key={att.id}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    p: 1, borderRadius: 1.5, bgcolor: '#f8fafc',
                    border: '1px solid', borderColor: '#e2e8f0',
                  }}
                >
                  <FileTypeIcon mimeType={att.mimeType} />
                  <Typography
                    variant='caption'
                    color='text.primary'
                    sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {att.signedUrl
                      ? <a href={att.signedUrl} target='_blank' rel='noreferrer' style={{ color: '#2563eb', textDecoration: 'none' }}>{att.fileName}</a>
                      : att.fileName
                    }
                  </Typography>
                  <IconButton
                    size='small'
                    disabled={deletingId === att.id}
                    onClick={() => deleteAttachment(att.id)}
                    sx={{ p: 0.5, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}
                  >
                    {deletingId === att.id
                      ? <CircularProgress size={12} />
                      : <DeleteOutlined sx={{ fontSize: 14 }} />
                    }
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          {/* Pending (not yet uploaded) files */}
          {pendingFiles.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {pendingFiles.map((file, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    p: 1, borderRadius: 1.5, bgcolor: '#eff6ff',
                    border: '1px dashed', borderColor: '#93c5fd',
                  }}
                >
                  <InsertDriveFileOutlined sx={{ fontSize: 16, color: '#2563eb' }} />
                  <Typography variant='caption' color='text.primary' sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </Typography>
                  <Typography variant='caption' color='text.secondary' sx={{ flexShrink: 0 }}>
                    {formatBytes(file.size)}
                  </Typography>
                  <IconButton
                    size='small'
                    onClick={() => removePending(idx)}
                    sx={{ p: 0.5, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}
                  >
                    <DeleteOutlined sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          {attachments.length === 0 && pendingFiles.length === 0 && (
            <Typography variant='caption' color='text.secondary'>
              No attachments. Accepted formats: JPG, PNG, PDF (max 5 MB each).
            </Typography>
          )}
        </Box>
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={handleClose} disabled={loading || decrypting}>
          Cancel
        </Button>
        <Button variant='contained' onClick={handleSubmit} loading={loading} disabled={decrypting}>
          {isEdit ? 'Save changes' : 'Create record'}
        </Button>
      </Box>
    </Dialog>
  )
}
