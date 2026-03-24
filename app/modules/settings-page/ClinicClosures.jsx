'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import OutlinedInput from '@mui/material/OutlinedInput'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Input from '@/components/commons/Input'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { Trash2 } from 'lucide-react'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export default function ClinicClosures({ clinicId }) {
  const { showToast } = useToast()

  const [closures, setClosures] = useState([])
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/clinics/${clinicId}/closures`)
      .then((r) => r.json())
      .then(setClosures)
      .catch(() => showToast('Failed to load closures', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    if (!date) {
      showToast('Please select a date', 'error')
      return
    }

    setAdding(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/closures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason })
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error ?? 'Failed to add closure', 'error')
        return
      }
      setClosures((prev) => [...prev, data].sort((a, b) => new Date(a.date) - new Date(b.date)))
      setDate('')
      setReason('')
      showToast('Closure date added', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/closures/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Failed to remove closure', 'error')
        return
      }
      setClosures((prev) => prev.filter((c) => c.id !== id))
      showToast('Closure date removed', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Add new closure */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems='flex-end'>
        <Box sx={{ flex: 1 }}>
          <Typography
            component='label'
            htmlFor='closure-date'
            variant='body2'
            fontWeight={500}
            color='text.primary'
            display='block'
            sx={{ mb: 0.75 }}
          >
            Date
          </Typography>
          <OutlinedInput
            id='closure-date'
            type='date'
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
          />
        </Box>

        <Box sx={{ flex: 2 }}>
          <Input
            id='closure-reason'
            label='Reason (optional)'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='e.g. National Holiday, Maintenance'
          />
        </Box>

        <Box sx={{ pb: 0.25 }}>
          <Button variant='contained' loading={adding} onClick={handleAdd}>
            Add
          </Button>
        </Box>
      </Stack>

      {/* Closure list */}
      {loading ? (
        <Typography variant='body2' color='text.secondary'>
          Loading...
        </Typography>
      ) : closures.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          No closure dates set.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {closures.map((c) => (
            <Box
              key={c.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.25,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#fafafa'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <Typography variant='body2' fontWeight={500} color='text.primary'>
                  {formatDate(c.date)}
                </Typography>
                {c.reason && (
                  <Chip label={c.reason} size='small' sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 500 }} />
                )}
              </Box>
              <IconButton
                size='small'
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
                sx={{ color: '#E05C6A', flexShrink: 0 }}
              >
                <Trash2 size={16} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
