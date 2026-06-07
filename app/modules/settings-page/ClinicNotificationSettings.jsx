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
import Collapse from '@mui/material/Collapse'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import TextField from '@mui/material/TextField'
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

const TEMPLATE_VARS = ['{{firstName}}', '{{patientName}}', '{{serviceName}}', '{{scheduledAt}}', '{{appointmentCode}}']

const DEFAULT_CONFIG = Object.fromEntries(NOTIF_TYPES.map((t) => [t.key, { inApp: true, email: true }]))

export default function ClinicNotificationSettings({ clinicId }) {
  const { showToast } = useToast()
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [config, setConfig]       = useState(DEFAULT_CONFIG)
  const [reminder1, setReminder1] = useState('24')
  const [reminder2, setReminder2] = useState('2')
  const [expanded, setExpanded]   = useState(null)

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
    setConfig((prev) => ({ ...prev, [key]: { ...prev[key], [channel]: !prev[key][channel] } }))
  }

  function setTemplate(key, field, value) {
    setConfig((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  function resetTemplate(key) {
    setConfig((prev) => {
      const { emailSubject, emailBody, ...rest } = prev[key] ?? {}  // eslint-disable-line no-unused-vars
      return { ...prev, [key]: rest }
    })
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
    <Box sx={{ maxWidth: 680 }}>
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
        Toggle delivery channels per event type. Click the row to edit the email subject and body template.
      </Typography>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Table size='small'>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>Event</TableCell>
              <TableCell align='center' sx={{ fontWeight: 600, fontSize: '0.8125rem', width: 80 }}>In-App</TableCell>
              <TableCell align='center' sx={{ fontWeight: 600, fontSize: '0.8125rem', width: 80 }}>Email</TableCell>
              <TableCell align='center' sx={{ fontWeight: 600, fontSize: '0.8125rem', width: 56 }}>Template</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {NOTIF_TYPES.map((t) => {
              const hasTemplate = !!(config[t.key]?.emailSubject || config[t.key]?.emailBody)
              const isOpen = expanded === t.key
              return (
                <>
                  <TableRow key={t.key} hover sx={{ cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : t.key)}>
                    <TableCell sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {t.label}
                        {hasTemplate && <Chip label='custom' size='small' color='primary' variant='outlined' sx={{ fontSize: '0.65rem', height: 18 }} />}
                      </Box>
                    </TableCell>
                    <TableCell align='center' onClick={(e) => e.stopPropagation()}>
                      <Switch size='small' checked={config[t.key]?.inApp !== false} onChange={() => toggle(t.key, 'inApp')} disabled={loading} color='primary' />
                    </TableCell>
                    <TableCell align='center' onClick={(e) => e.stopPropagation()}>
                      <Switch size='small' checked={config[t.key]?.email !== false} onChange={() => toggle(t.key, 'email')} disabled={loading} color='primary' />
                    </TableCell>
                    <TableCell align='center'>
                      <IconButton size='small' disabled={loading}>
                        {isOpen ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${t.key}-tpl`}>
                    <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                      <Collapse in={isOpen} unmountOnExit>
                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid', borderColor: 'divider' }}>
                          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1 }}>
                            Available variables:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                            {TEMPLATE_VARS.map((v) => (
                              <Chip key={v} label={v} size='small' variant='outlined' sx={{ fontSize: '0.7rem', fontFamily: 'monospace', cursor: 'pointer' }}
                                onClick={() => navigator.clipboard?.writeText(v)} />
                            ))}
                          </Box>
                          <Input
                            id={`${t.key}-subject`}
                            label='Email subject (leave blank to use default)'
                            value={config[t.key]?.emailSubject ?? ''}
                            onChange={(e) => setTemplate(t.key, 'emailSubject', e.target.value)}
                            disabled={loading}
                            sx={{ mb: 1.5 }}
                          />
                          <TextField
                            label='Email body (leave blank to use default)'
                            multiline
                            minRows={3}
                            maxRows={8}
                            fullWidth
                            size='small'
                            value={config[t.key]?.emailBody ?? ''}
                            onChange={(e) => setTemplate(t.key, 'emailBody', e.target.value)}
                            disabled={loading}
                            sx={{ mb: 1.5, '& .MuiInputLabel-root': { fontSize: '0.875rem' } }}
                          />
                          {hasTemplate && (
                            <Button variant='outlined' size='small' onClick={() => resetTemplate(t.key)} disabled={loading}>
                              Reset to default
                            </Button>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              )
            })}
          </TableBody>
        </Table>
      </Box>

      <Button variant='contained' onClick={handleSave} loading={saving} disabled={loading}>
        Save Notification Settings
      </Button>
    </Box>
  )
}
