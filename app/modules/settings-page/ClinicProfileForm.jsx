'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Input from '@/components/commons/Input'
import Button from '@/components/commons/Button'

export default function ClinicProfileForm({ form, errors, saving, loading, onChange, onSave }) {
  if (loading) {
    return (
      <Typography variant='body2' color='text.secondary'>
        Loading...
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
      <Input
        id='clinic-address'
        label='Address'
        value={form.address}
        onChange={onChange('address')}
        placeholder='Full clinic address'
        error={!!errors.address}
        helperText={errors.address}
        required
      />
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
      <Input
        id='clinic-phone'
        label='Mobile'
        value={form.phone}
        onChange={onChange('phone')}
        placeholder='+639XXXXXXXXX'
      />
      <Input
        id='clinic-landline'
        label='Landline (optional)'
        value={form.landline}
        onChange={onChange('landline')}
        placeholder='e.g. (02) 8XXX-XXXX'
      />

      <Box sx={{ pt: 1 }}>
        <Button variant='contained' loading={saving} onClick={onSave}>
          Save Changes
        </Button>
      </Box>
    </Box>
  )
}
