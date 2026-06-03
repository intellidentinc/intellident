'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Switch from '@mui/material/Switch'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'

const NOTIF_TYPES = [
  { key: 'BOOKING_REQUEST',        label: 'New Booking Request' },
  { key: 'APPOINTMENT_CONFIRMED',  label: 'Appointment Confirmed' },
  { key: 'APPOINTMENT_CANCELLED',  label: 'Appointment Cancelled' },
  { key: 'APPOINTMENT_COMPLETED',  label: 'Appointment Completed' },
  { key: 'APPOINTMENT_NO_SHOW',    label: 'Appointment No-show' },
  { key: 'APPOINTMENT_RESCHEDULED',label: 'Appointment Rescheduled' },
  { key: 'REMINDER_24H',           label: 'First Reminder (before appointment)' },
  { key: 'REMINDER_2H',            label: 'Second Reminder (before appointment)' },
  { key: 'PAYMENT_RECEIVED',       label: 'Payment Received' },
]

const DEFAULT_CONFIG = Object.fromEntries(NOTIF_TYPES.map((t) => [t.key, { inApp: true, email: true }]))

export default function ClinicNotificationSettings({ clinicId }) {
  const { showToast } = useToast()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [config, setConfig]     = useState(DEFAULT_CONFIG)
  const [reminder1, setReminder1] = useState('24')
  const [reminder2, setReminder2] = useState('2')

  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/clinics/${clinicId}/profile`)
      .then((r) => r.json())
      .then((data) => {
        setConfig({ ...DEFAULT_CONFIG, ...(data.notifConfig ?? {}) })
        setReminder1(String(data.reminder1Hours ?? 24))
        setReminder2(String(data.reminder2Hours ?? 2))
      })
      .catch(() => showToast('Failed to load notification settings', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(key, channel) {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key][channel] },
    }))
  }

  async function handleSave() {
    const r1 = parseInt(reminder1, 10)
    const r2 = parseInt(reminder2, 10)
    if (isNaN(r1) || r1 < 1) { showToast('First reminder must be at least 1 hour', 'error'); return }
    if (isNaN(r2) || r2 < 1) { showToast('Second reminder must be at least 1 hour', 'error'); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifConfig: config, reminder1Hours: r1, reminder2Hours: r2 }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error ?? 'Failed to save', 'error')
        return
      }
      showToast('Notification settings saved', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant='subtitle2' fontWeight={600} color='text.primary' sx={{ mb: 1 }}>
        Reminder Intervals
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ mb: 2, display: 'block' }}>
        How many hours before an appointment each reminder is sent.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Input
          id='reminder1'
          label='First reminder (hours before)'
          type='number'
          value={reminder1}
          onChange={(e) => setReminder1(e.target.value)}
          disabled={loading}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
        />
        <Input
          id='reminder2'
          label='Second reminder (hours before)'
          type='number'
          value={reminder2}
          onChange={(e) => setReminder2(e.target.value)}
          disabled={loading}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
        />
      </Box>

      <Typography variant='subtitle2' fontWeight={600} color='text.primary' sx={{ mb: 1 }}>
        Notification Types
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ mb: 2, display: 'block' }}>
        Toggle in-app bell notifications and email notifications per event type.
      </Typography>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Table size='small'>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>Event</TableCell>
              <TableCell align='center' sx={{ fontWeight: 600, fontSize: '0.8125rem', width: 80 }}>In-App</TableCell>
              <TableCell align='center' sx={{ fontWeight: 600, fontSize: '0.8125rem', width: 80 }}>Email</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {NOTIF_TYPES.map((t) => (
              <TableRow key={t.key} hover>
                <TableCell sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>{t.label}</TableCell>
                <TableCell align='center'>
                  <Switch
                    size='small'
                    checked={config[t.key]?.inApp !== false}
                    onChange={() => toggle(t.key, 'inApp')}
                    disabled={loading}
                    color='primary'
                  />
                </TableCell>
                <TableCell align='center'>
                  <Switch
                    size='small'
                    checked={config[t.key]?.email !== false}
                    onChange={() => toggle(t.key, 'email')}
                    disabled={loading}
                    color='primary'
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Button variant='contained' onClick={handleSave} loading={saving} disabled={loading}>
        Save Notification Settings
      </Button>
    </Box>
  )
}
