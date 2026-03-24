'use client'

import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Button from '@/components/commons/Button'
import Select from '@/components/commons/Select'
import { useToast } from '@/app/providers/ToastProvider'
import { ManageAccountsOutlined } from '@mui/icons-material'

const ROLE_OPTIONS = [
  { value: 'PATIENT', label: 'Patient' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
  { value: 'DENTIST', label: 'Dentist' },
  { value: 'ADMIN', label: 'Admin' }
]

export default function EditRoleModal({ open, user, onClose, onSuccess }) {
  const { showToast } = useToast()
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) setRole(user.role)
  }, [user])

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      if (!res.ok) throw new Error()
      showToast('Role updated', 'success')
      onSuccess()
    } catch {
      showToast('Failed to update role', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='xs'
      fullWidth
      slotProps={{
        paper: {
          sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }
        }
      }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: 0.25
          }}
        >
          <ManageAccountsOutlined sx={{ fontSize: 20, color: '#2563eb' }} />
        </Box>
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            Edit User Role
          </Typography>
          {user && (
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              {user.firstName} {user.lastName}
            </Typography>
          )}
        </Box>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Select
          id='role'
          label='Role'
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={ROLE_OPTIONS}
        />
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant='contained' onClick={handleSave} loading={loading}>
          Save changes
        </Button>
      </Box>
    </Dialog>
  )
}
