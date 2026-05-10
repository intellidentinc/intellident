'use client'

import { useState, useEffect } from 'react'
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
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'
import { useCrypto } from '@/app/providers/CryptoProvider'
import { encryptData, decryptData, toBase64 } from '@/lib/crypto'
import { ArticleOutlined } from '@mui/icons-material'

const EMPTY_FORM = { title: '', notes: '', status: 'ACTIVE' }
const EMPTY_ERRORS = { title: '', notes: '' }

export default function RecordFormModal({ open, patientId, record, onClose, onSuccess }) {
  const { showToast } = useToast()
  const { masterKey } = useCrypto()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState(EMPTY_ERRORS)
  const [loading, setLoading] = useState(false)
  const [decrypting, setDecrypting] = useState(false)

  const isEdit = !!record

  // Fetch and decrypt notes when opening in edit mode
  useEffect(() => {
    if (!open || !record) return

    async function fetchAndDecrypt() {
      if (!masterKey) {
        showToast('Your session has expired. Please sign in again.', 'error')
        onClose()
        return
      }
      setDecrypting(true)
      try {
        const res = await fetch(`/api/records/${patientId}/${record.id}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const { encryptedData, dataIv, contentHash, title, status } = data.record

        let notes = ''
        try {
          notes = await decryptData(masterKey, encryptedData, dataIv)
        } catch {
          showToast('Failed to decrypt record. The data may be corrupted.', 'error')
          onClose()
          return
        }

        // Tamper detection
        const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(notes))
        const recomputed = toBase64(hashBuf)
        if (recomputed !== contentHash) {
          showToast('Record may have been tampered with', 'warning')
        }

        setForm({ title, notes, status: status ?? 'ACTIVE' })
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

  async function handleSubmit() {
    if (!validate()) return
    if (!masterKey) {
      showToast('Your session has expired. Please sign in again.', 'error')
      return
    }
    setLoading(true)
    try {
      // Compute SHA-256 of plaintext for tamper detection
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(form.notes))
      const contentHash = toBase64(hashBuf)

      // Encrypt notes with master key
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
