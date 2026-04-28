'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { Stethoscope, MapPin, Mail, Phone, LogIn } from 'lucide-react'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import SignOutButton from '@/app/modules/dashboard-page/SignOutButton'

export default function SuperPage({ clinics }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [entering, setEntering] = useState(null)

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
      <Box sx={{ px: { xs: 3, sm: 5 }, py: 5, maxWidth: 900, mx: 'auto' }}>
        <Typography variant='h5' fontWeight={700} color='text.primary' mb={0.5}>
          Clinics
        </Typography>
        <Typography variant='body2' color='text.secondary' mb={4}>
          Select a clinic to enter as Admin.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2.5 }}>
          {clinics.map((clinic) => (
            <ClinicCard
              key={clinic.id}
              clinic={clinic}
              loading={entering === clinic.id}
              onEnter={() => handleEnter(clinic.id)}
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function ClinicCard({ clinic, loading, onEnter }) {
  return (
    <Box
      sx={{
        bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3,
        p: 3, display: 'flex', flexDirection: 'column', gap: 1.5,
        transition: 'box-shadow 0.15s', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.07)' },
      }}
    >
      {/* Logo / icon */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
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

      {/* Details */}
      {clinic.address && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <MapPin size={14} color='#94a3b8' style={{ marginTop: 2, flexShrink: 0 }} />
          <Typography variant='caption' color='text.secondary'>{clinic.address}</Typography>
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
