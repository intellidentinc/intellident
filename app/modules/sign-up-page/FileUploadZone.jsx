'use client'

import { useState, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { Upload, X, FileText, ImageIcon } from 'lucide-react'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const ACCEPT_ATTR    = '.pdf,.jpg,.jpeg,.png'
const MAX_SIZE       = 5 * 1024 * 1024 // 5 MB

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ type }) {
  if (type === 'application/pdf')
    return <FileText size={15} color="#dc2626" />
  return <ImageIcon size={15} color="#2563eb" />
}

export default function FileUploadZone({ label, hint, files, onAdd, onRemove, error, required, maxFiles = 5 }) {
  const inputRef = useRef(null)
  const [dragging,   setDragging]   = useState(false)
  const [localError, setLocalError] = useState('')

  function processFiles(fileList) {
    setLocalError('')
    const incoming = Array.from(fileList)

    const badType = incoming.some(f => !ACCEPTED_TYPES.includes(f.type))
    if (badType) { setLocalError('Only PDF, JPG, and PNG files are accepted.'); return }

    const tooBig = incoming.some(f => f.size > MAX_SIZE)
    if (tooBig) { setLocalError('Each file must be 5 MB or smaller.'); return }

    const available = maxFiles - files.length
    if (available > 0) onAdd(incoming.slice(0, available))
  }

  const canAdd = files.length < maxFiles
  const displayError = error || localError

  return (
    <Box>
      {/* Label */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
        <Typography variant="body2" fontWeight={600} color="text.primary">{label}</Typography>
        {required && <Typography component="span" sx={{ color: '#E05C6A', fontSize: 14, lineHeight: 1 }}>*</Typography>}
      </Box>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
          {hint}
        </Typography>
      )}

      {/* Drop zone */}
      <Box
        onClick={() => canAdd && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (canAdd) setDragging(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files) }}
        sx={{
          border: '2px dashed',
          borderColor: displayError ? 'error.main' : dragging ? 'primary.main' : '#cbd5e1',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          cursor: canAdd ? 'pointer' : 'default',
          bgcolor: dragging ? '#eff6ff' : '#f8fafc',
          transition: 'all 0.15s',
          '&:hover': canAdd ? { borderColor: 'primary.main', bgcolor: '#eff6ff' } : {},
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={(e) => { processFiles(e.target.files); e.target.value = '' }}
          style={{ display: 'none' }}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={20} color="#2563eb" />
          </Box>
          <Typography variant="body2" fontWeight={500} color={canAdd ? 'text.primary' : 'text.disabled'}>
            {canAdd ? 'Click to upload or drag & drop' : `Maximum ${maxFiles} files reached`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            PDF, JPG, PNG · Max 5 MB each · Up to {maxFiles} files
          </Typography>
        </Box>
      </Box>

      {/* Error */}
      {displayError && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {displayError}
        </Typography>
      )}

      {/* File list */}
      {files.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {files.map((f, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 1.5, py: 1, borderRadius: 1.5,
                bgcolor: '#f1f5f9', border: '1px solid', borderColor: 'divider',
              }}
            >
              <FileIcon type={f.type} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" fontWeight={500} color="text.primary"
                  sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">{formatSize(f.size)}</Typography>
              </Box>
              <IconButton size="small" onClick={() => onRemove(i)} sx={{ flexShrink: 0, color: 'text.secondary' }}>
                <X size={14} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
