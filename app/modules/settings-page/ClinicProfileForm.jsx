'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Input from '@/components/commons/Input'
import Button from '@/components/commons/Button'
import AddressSelector from '@/components/commons/AddressSelector'

function SectionCard({ title, subtitle, children, onSave, saving, saveLabel = 'Save Changes' }) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2.5,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 3, py: 2, bgcolor: '#F8FAFC', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant='body2' fontWeight={700} color='text.primary'>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant='caption' color='text.secondary'>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {children}
        {onSave && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant='contained' size='small' loading={saving} onClick={onSave}>
              {saveLabel}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default function ClinicProfileForm({ form, errors, saving, loading, onChange, onAddressChange, onSave }) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 2, bgcolor: '#F8FAFC', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Skeleton width={120} height={20} />
            </Box>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Skeleton height={56} />
              <Skeleton height={56} />
            </Box>
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* Clinic Identity */}
      <SectionCard title='Clinic Identity' onSave={onSave} saving={saving}>
        <Input
          id='clinic-name'
          label='Clinic Name'
          value={form.name}
          onChange={onChange('name')}
          placeholder='e.g. Maria Laura Cruz Dental Clinic'
          error={!!errors.name}
          helperText={errors.name}
          required
        />
      </SectionCard>

      {/* Address */}
      <SectionCard
        title='Address'
        subtitle='Select location from the dropdowns, then fill in the street details.'
        onSave={onSave}
        saving={saving}
        saveLabel='Save Address'
      >
        <AddressSelector
          value={form.address}
          onChange={onAddressChange}
          errors={{ cityMuni: errors.addressCityMuni }}
          required
        />
      </SectionCard>

      {/* Contact Information */}
      <SectionCard title='Contact Information' onSave={onSave} saving={saving}>
        <Input
          id='clinic-email'
          label='Email'
          type='email'
          value={form.email}
          onChange={onChange('email')}
          placeholder='clinic@example.com'
          error={!!errors.email}
          helperText={errors.email}
          required
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Input
            id='clinic-phone'
            label='Mobile'
            value={form.phone}
            onChange={onChange('phone')}
            placeholder='+639XXXXXXXXX'
            error={!!errors.phone}
            helperText={errors.phone}
          />
          <Input
            id='clinic-landline'
            label='Landline (optional)'
            value={form.landline}
            onChange={onChange('landline')}
            placeholder='e.g. (02) 8XXX-XXXX'
          />
        </Box>
      </SectionCard>
    </Box>
  )
}
