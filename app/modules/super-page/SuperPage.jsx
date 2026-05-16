'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Divider from '@mui/material/Divider'
import { DeleteOutlined } from '@mui/icons-material'
import { Stethoscope, MapPin, Mail, Phone, LogIn, Plus, Pencil, Trash2 } from 'lucide-react'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import AddressSelector, { EMPTY_ADDRESS, assembleAddress } from '@/components/commons/AddressSelector'
import { useToast } from '@/app/providers/ToastProvider'
import SignOutButton from '@/app/modules/dashboard-page/SignOutButton'

export default function SuperPage({ clinics: initialClinics }) {
  const router = useRouter()
  const { showToast } = useToast()

  const [clinics, setClinics] = useState(initialClinics)
  const [entering, setEntering] = useState(null)

  // Form modal (create / edit)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // null = create
  const [formLoading, setFormLoading] = useState(false)
  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState({ ...EMPTY_ADDRESS })
  const [formPhone, setFormPhone] = useState('')
  const [formErrors, setFormErrors] = useState({})

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleEnter(clinicId) {
    setEntering(clinicId)
    try {
      const res = await fetch('/api/super/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      if (!res.ok) throw new Error()
      router.push(`/${clinicId}/dashboard`)
    } catch {
      showToast('Failed to enter clinic', 'error')
      setEntering(null)
    }
  }

  function openCreate() {
    setEditTarget(null)
    setFormName('')
    setFormAddress({ ...EMPTY_ADDRESS })
    setFormPhone('')
    setFormErrors({})
    setFormOpen(true)
  }

  function openEdit(clinic) {
    setEditTarget(clinic)
    setFormName(clinic.name)
    let parsedAddr = { ...EMPTY_ADDRESS }
    if (clinic.address) {
      try { parsedAddr = { ...EMPTY_ADDRESS, ...JSON.parse(clinic.address) } }
      catch { parsedAddr = { ...EMPTY_ADDRESS, street: clinic.address } }
    }
    setFormAddress(parsedAddr)
    setFormPhone(clinic.phone || '')
    setFormErrors({})
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
  }

  async function handleFormSubmit() {
    const errors = {}
    if (!formName.trim()) errors.name = 'Clinic name is required'
    if (formPhone.trim() && !/^\+639\d{9}$/.test(formPhone.trim())) {
      errors.phone = 'Must be in +63XXXXXXXXXX format (starts with +639)'
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors)
      return
    }

    setFormLoading(true)
    try {
      const url = editTarget ? `/api/super/clinics/${editTarget.id}` : '/api/super/clinics'
      const method = editTarget ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, address: formAddress, phone: formPhone }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Something went wrong', 'error')
        return
      }

      if (editTarget) {
        setClinics((prev) => prev.map((c) => (c.id === editTarget.id ? data : c)))
        showToast('Clinic updated', 'success')
      } else {
        setClinics((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        showToast('Clinic created', 'success')
      }
      setFormOpen(false)
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setFormLoading(false)
    }
  }

  function openDelete(clinic) {
    setDeleteTarget(clinic)
  }

  function closeDelete() {
    setDeleteTarget(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/super/clinics/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to delete clinic', 'error')
        return
      }
      setClinics((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      showToast('Clinic deleted', 'success')
      setDeleteTarget(null)
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#fff', borderBottom: '1px solid', borderColor: 'divider',
          px: { xs: 3, sm: 5 }, py: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Stethoscope size={20} color='#2563eb' />
          </Box>
          <Box>
            <Typography variant='subtitle1' fontWeight={700} color='#2563eb' lineHeight={1.2}>IntelliDent</Typography>
            <Typography variant='caption' color='text.secondary'>Super Admin Portal</Typography>
          </Box>
        </Box>
        <SignOutButton />
      </Box>

      {/* Content */}
      <Box sx={{ px: { xs: 3, sm: 5 }, py: 5, maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4 }}>
          <Box>
            <Typography variant='h5' fontWeight={700} color='text.primary' mb={0.5}>
              Clinics
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Select a clinic to enter as Admin.
            </Typography>
          </Box>
          <Button variant='contained' startIcon={<Plus size={16} />} onClick={openCreate}>
            Create Clinic
          </Button>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
          {clinics.map((clinic) => (
            <ClinicCard
              key={clinic.id}
              clinic={clinic}
              loading={entering === clinic.id}
              onEnter={() => handleEnter(clinic.id)}
              onEdit={() => openEdit(clinic)}
              onDelete={() => openDelete(clinic)}
            />
          ))}
        </Box>
      </Box>

      {/* Create / Edit Modal */}
      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth='sm' PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {editTarget ? 'Edit Clinic' : 'Create Clinic'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '12px !important' }}>

          {/* Clinic Name */}
          <Input
            id='form-clinic-name'
            label='Clinic Name'
            required
            value={formName}
            onChange={(e) => { setFormName(e.target.value); setFormErrors((p) => ({ ...p, name: '' })) }}
            error={!!formErrors.name}
            helperText={formErrors.name}
            placeholder='e.g. Maria Laura Cruz Dental Clinic'
          />

          {/* Address section */}
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 2, py: 1.25, bgcolor: '#F8FAFC', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant='caption' fontWeight={700} color='text.secondary' sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Address
              </Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <AddressSelector
                value={formAddress}
                onChange={setFormAddress}
              />
            </Box>
          </Box>

          {/* Phone */}
          <Input
            id='form-clinic-phone'
            label='Phone'
            value={formPhone}
            onChange={(e) => { setFormPhone(e.target.value); setFormErrors((p) => ({ ...p, phone: '' })) }}
            error={!!formErrors.phone}
            helperText={formErrors.phone || '+63XXXXXXXXXX format'}
            placeholder='+639XXXXXXXXX'
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button variant='outlined' onClick={closeForm} disabled={formLoading}>
            Cancel
          </Button>
          <Button variant='contained' loading={formLoading} onClick={handleFormSubmit}>
            {editTarget ? 'Save Changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={closeDelete}
        maxWidth='xs'
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
      >
        <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
            <DeleteOutlined sx={{ fontSize: 20, color: '#dc2626' }} />
          </Box>
          <Box>
            <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
              Delete Clinic
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
              This action cannot be undone
            </Typography>
          </Box>
        </Box>

        <Divider />

        <Box sx={{ px: 3, py: 2.5 }}>
          <Typography variant='body2' color='text.secondary' lineHeight={1.7}>
            You are about to permanently delete{' '}
            <Typography component='span' variant='body2' fontWeight={600} color='text.primary'>
              {deleteTarget?.name}
            </Typography>
            . All data associated with this clinic will be removed.
          </Typography>
        </Box>

        <Divider />

        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant='outlined' onClick={closeDelete} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button
            variant='contained'
            loading={deleteLoading}
            onClick={handleDelete}
            sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
          >
            Delete Clinic
          </Button>
        </Box>
      </Dialog>
    </Box>
  )
}

function ClinicCard({ clinic, loading, onEnter, onEdit, onDelete }) {
  return (
    <Box
      sx={{
        bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3,
        p: 3, display: 'flex', flexDirection: 'column', gap: 1.5,
        transition: 'box-shadow 0.15s', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.07)' },
      }}
    >
      {/* Logo / icon + actions */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {clinic.logoUrl ? (
            <img src={clinic.logoUrl} alt='logo' style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Stethoscope size={20} color='#2563eb' />
            </Box>
          )}
          <Box>
            <Typography variant='subtitle2' fontWeight={700} color='text.primary' lineHeight={1.3}>
              {clinic.name}
            </Typography>
            {clinic.code && (
              <Typography variant='caption' sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', px: 1, py: 0.25, borderRadius: 1, fontWeight: 600, fontSize: '0.68rem' }}>
                {clinic.code}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Edit / Delete icon buttons */}
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          <Box
            component='button'
            onClick={onEdit}
            sx={{
              border: 'none', bgcolor: 'transparent', cursor: 'pointer', p: 0.75, borderRadius: 1.5,
              color: '#64748b', display: 'flex', alignItems: 'center',
              '&:hover': { bgcolor: '#f1f5f9', color: '#2563eb' },
            }}
          >
            <Pencil size={15} />
          </Box>
          <Box
            component='button'
            onClick={onDelete}
            sx={{
              border: 'none', bgcolor: 'transparent', cursor: 'pointer', p: 0.75, borderRadius: 1.5,
              color: '#64748b', display: 'flex', alignItems: 'center',
              '&:hover': { bgcolor: '#fee2e2', color: '#b91c1c' },
            }}
          >
            <Trash2 size={15} />
          </Box>
        </Box>
      </Box>

      {/* Details */}
      {clinic.address && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <MapPin size={14} color='#94a3b8' style={{ marginTop: 2, flexShrink: 0 }} />
          <Typography variant='caption' color='text.secondary'>
            {(() => { try { return assembleAddress(JSON.parse(clinic.address)) } catch { return clinic.address } })()}
          </Typography>
        </Box>
      )}
      {clinic.email && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Mail size={14} color='#94a3b8' />
          <Typography variant='caption' color='text.secondary'>{clinic.email}</Typography>
        </Box>
      )}
      {clinic.phone && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Phone size={14} color='#94a3b8' />
          <Typography variant='caption' color='text.secondary'>{clinic.phone}</Typography>
        </Box>
      )}

      {/* Enter button */}
      <Button
        variant='contained'
        size='small'
        loading={loading}
        onClick={onEnter}
        sx={{ mt: 'auto', pt: 1 }}
        startIcon={!loading && <LogIn size={15} />}
      >
        Enter as Admin
      </Button>
    </Box>
  )
}
