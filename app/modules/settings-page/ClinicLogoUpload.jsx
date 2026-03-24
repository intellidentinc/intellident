'use client'

import { useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { Stethoscope } from 'lucide-react'

export default function ClinicLogoUpload({ clinicId, logoUrl, logoPreview, uploading, onUploadStart, onUploadDone }) {
  const { showToast } = useToast()
  const fileInputRef = useRef(null)
  const displayLogo = logoPreview ?? logoUrl

  async function handleChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      showToast('Only JPG and PNG files are allowed', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File must be under 5MB', 'error')
      return
    }

    onUploadStart(URL.createObjectURL(file))

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/clinics/${clinicId}/logo`, { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error ?? 'Upload failed', 'error')
        onUploadDone(null)
        return
      }

      onUploadDone(data.logoUrl)
      showToast('Logo updated', 'success')
    } catch {
      showToast('Something went wrong', 'error')
      onUploadDone(null)
    } finally {
      e.target.value = ''
    }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {displayLogo ? (
        <Avatar src={displayLogo} alt='Clinic logo' sx={{ width: 80, height: 80 }} />
      ) : (
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Stethoscope size={32} color='#2563eb' />
        </Box>
      )}

      <Box>
        <Typography variant='subtitle2' fontWeight={600} color='text.primary' gutterBottom>
          Clinic Logo
        </Typography>
        <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1 }}>
          JPG or PNG, max 5MB
        </Typography>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/jpeg,image/png'
          style={{ display: 'none' }}
          onChange={handleChange}
        />
        <Button variant='outlined' size='small' loading={uploading} onClick={() => fileInputRef.current?.click()}>
          Upload Logo
        </Button>
      </Box>
    </Box>
  )
}
