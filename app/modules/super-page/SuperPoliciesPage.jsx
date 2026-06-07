'use client'

import { useState, useEffect, useCallback } from 'react'
import { SidebarInset } from '@/components/ui/sidebar'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import { Shield, Clock, Archive } from 'lucide-react'
import Button from '@/components/commons/Button'
import SuperPageHeader from './SuperPageHeader'
import { useToast } from '@/app/providers/ToastProvider'

export default function SuperPoliciesPage() {
  const { showToast } = useToast()

  const [clinics, setClinics] = useState([])
  const [loadingClinics, setLoadingClinics] = useState(true)

  // Security policy state
  const [passwordExpiry, setPasswordExpiry] = useState(false)
  const [singleSession, setSingleSession] = useState(false)
  const [securityLoading, setSecurityLoading] = useState(false)
  const [securityConfirm, setSecurityConfirm] = useState(false)

  // Reminders state
  const [reminder1, setReminder1] = useState(24)
  const [reminder2, setReminder2] = useState(2)
  const [remindersLoading, setRemindersLoading] = useState(false)
  const [remindersConfirm, setRemindersConfirm] = useState(false)

  // Audit retention state
  const [retentionEnabled, setRetentionEnabled] = useState(false)
  const [retentionDays, setRetentionDays] = useState(90)
  const [retentionLoading, setRetentionLoading] = useState(false)
  const [retentionConfirm, setRetentionConfirm] = useState(false)

  const fetchClinics = useCallback(async () => {
    try {
      const res = await fetch('/api/super/policies')
      const data = await res.json()
      setClinics(Array.isArray(data) ? data : [])
    } catch {
      showToast('Failed to load clinic policy data', 'error')
    } finally {
      setLoadingClinics(false)
    }
  }, [showToast])

  useEffect(() => { fetchClinics() }, [fetchClinics])

  async function applyPolicy(patch) {
    const res = await fetch('/api/super/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicIds: ['all'], patch }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to apply policy')
    return data.updated
  }

  async function handleApplySecurity() {
    setSecurityLoading(true)
    try {
      const n = await applyPolicy({ passwordExpiryEnabled: passwordExpiry, singleSessionEnabled: singleSession })
      showToast(`Security policies applied to ${n} clinic${n !== 1 ? 's' : ''}`, 'success')
      setSecurityConfirm(false)
      setLoadingClinics(true)
      await fetchClinics()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSecurityLoading(false)
    }
  }

  async function handleApplyReminders() {
    setRemindersLoading(true)
    try {
      const n = await applyPolicy({ reminder1Hours: Number(reminder1), reminder2Hours: Number(reminder2) })
      showToast(`Reminder settings applied to ${n} clinic${n !== 1 ? 's' : ''}`, 'success')
      setRemindersConfirm(false)
      setLoadingClinics(true)
      await fetchClinics()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setRemindersLoading(false)
    }
  }

  async function handleApplyRetention() {
    setRetentionLoading(true)
    try {
      const val = retentionEnabled ? Number(retentionDays) : null
      const n = await applyPolicy({ auditLogRetentionDays: val })
      showToast(`Audit retention applied to ${n} clinic${n !== 1 ? 's' : ''}`, 'success')
      setRetentionConfirm(false)
      setLoadingClinics(true)
      await fetchClinics()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setRetentionLoading(false)
    }
  }

  return (
    <SidebarInset>
      <SuperPageHeader title='Global Policies' />

      <Box sx={{ px: { xs: 3, sm: 5 }, py: 5, maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant='h5' fontWeight={700} color='text.primary' mb={0.5}>
            Global Policies
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Apply security, notification, and audit policies across all clinics at once.
          </Typography>
        </Box>

        {/* Security Policies */}
        <PolicyCard
          icon={<Shield size={18} color='#2563eb' />}
          title='Security Policies'
          description='Authentication and session security settings applied to all clinic staff.'
          onApply={() => setSecurityConfirm(true)}
        >
          <FormControlLabel
            control={<Switch checked={passwordExpiry} onChange={(e) => setPasswordExpiry(e.target.checked)} />}
            label={
              <Box sx={{ ml: 0.5 }}>
                <Typography variant='body2' fontWeight={600}>Password Expiry</Typography>
                <Typography variant='caption' color='text.secondary'>Admin accounts must change their password every 90 days.</Typography>
              </Box>
            }
            sx={{ alignItems: 'center', mt: 1, mb: 0.5 }}
          />
          <FormControlLabel
            control={<Switch checked={singleSession} onChange={(e) => setSingleSession(e.target.checked)} />}
            label={
              <Box sx={{ ml: 0.5 }}>
                <Typography variant='body2' fontWeight={600}>Single Active Session</Typography>
                <Typography variant='caption' color='text.secondary'>Users can only be signed in on one device at a time.</Typography>
              </Box>
            }
            sx={{ alignItems: 'center', mt: 1 }}
          />
        </PolicyCard>

        {/* Appointment Reminders */}
        <PolicyCard
          icon={<Clock size={18} color='#2563eb' />}
          title='Appointment Reminders'
          description='How many hours before an appointment patients receive reminder notifications.'
          onApply={() => setRemindersConfirm(true)}
        >
          <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant='body2' fontWeight={600} mb={0.75}>First reminder (hours before)</Typography>
              <TextField
                type='number'
                size='small'
                value={reminder1}
                onChange={(e) => setReminder1(e.target.value)}
                inputProps={{ min: 1, max: 72 }}
                sx={{ width: 140 }}
              />
            </Box>
            <Box>
              <Typography variant='body2' fontWeight={600} mb={0.75}>Second reminder (hours before)</Typography>
              <TextField
                type='number'
                size='small'
                value={reminder2}
                onChange={(e) => setReminder2(e.target.value)}
                inputProps={{ min: 1, max: 72 }}
                sx={{ width: 140 }}
              />
            </Box>
          </Box>
        </PolicyCard>

        {/* Audit Log Retention */}
        <PolicyCard
          icon={<Archive size={18} color='#2563eb' />}
          title='Audit Log Retention'
          description='Automatically purge audit logs older than the specified number of days.'
          onApply={() => setRetentionConfirm(true)}
        >
          <FormControlLabel
            control={<Switch checked={retentionEnabled} onChange={(e) => setRetentionEnabled(e.target.checked)} />}
            label={
              <Box sx={{ ml: 0.5 }}>
                <Typography variant='body2' fontWeight={600}>Enable Auto-Purge</Typography>
                <Typography variant='caption' color='text.secondary'>When off, audit logs are kept indefinitely.</Typography>
              </Box>
            }
            sx={{ alignItems: 'center', mt: 1 }}
          />
          {retentionEnabled && (
            <Box sx={{ mt: 2 }}>
              <Typography variant='body2' fontWeight={600} mb={0.75}>Retain logs for (days)</Typography>
              <TextField
                type='number'
                size='small'
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                inputProps={{ min: 1 }}
                sx={{ width: 140 }}
              />
            </Box>
          )}
        </PolicyCard>

        {/* Status summary table */}
        <Box sx={{ mt: 5 }}>
          <Typography variant='subtitle1' fontWeight={700} mb={2}>
            Current Policy Status Across Clinics
          </Typography>
          <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Table size='small'>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1.5 }}>Clinic</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1.5 }}>Password Expiry</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1.5 }}>Single Session</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1.5 }}>Reminders</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1.5 }}>Audit Retention</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingClinics ? (
                  <TableRow>
                    <TableCell colSpan={5} align='center' sx={{ py: 3, color: 'text.secondary', fontSize: '0.8rem' }}>
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : clinics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align='center' sx={{ py: 3, color: 'text.secondary', fontSize: '0.8rem' }}>
                      No clinics found
                    </TableCell>
                  </TableRow>
                ) : (
                  clinics.map((c) => (
                    <TableRow key={c.id} sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600, py: 1.25 }}>{c.name}</TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <BoolChip value={c.passwordExpiryEnabled} />
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <BoolChip value={c.singleSessionEnabled} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', py: 1.25 }}>
                        {c.reminder1Hours}h / {c.reminder2Hours}h
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', py: 1.25 }}>
                        {c.auditLogRetentionDays ? `${c.auditLogRetentionDays} days` : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      </Box>

      <ConfirmDialog
        open={securityConfirm}
        onClose={() => setSecurityConfirm(false)}
        onConfirm={handleApplySecurity}
        loading={securityLoading}
        clinicCount={clinics.length}
        title='Apply Security Policies'
      />
      <ConfirmDialog
        open={remindersConfirm}
        onClose={() => setRemindersConfirm(false)}
        onConfirm={handleApplyReminders}
        loading={remindersLoading}
        clinicCount={clinics.length}
        title='Apply Reminder Settings'
      />
      <ConfirmDialog
        open={retentionConfirm}
        onClose={() => setRetentionConfirm(false)}
        onConfirm={handleApplyRetention}
        loading={retentionLoading}
        clinicCount={clinics.length}
        title='Apply Audit Retention Policy'
      />
    </SidebarInset>
  )
}

function PolicyCard({ icon, title, description, onApply, children }) {
  return (
    <Paper variant='outlined' sx={{ borderRadius: 2, p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </Box>
          <Box>
            <Typography variant='subtitle2' fontWeight={700}>{title}</Typography>
            <Typography variant='caption' color='text.secondary'>{description}</Typography>
          </Box>
        </Box>
        <Button variant='contained' size='small' onClick={onApply} sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          Apply to All Clinics
        </Button>
      </Box>
      <Divider sx={{ my: 2 }} />
      {children}
    </Paper>
  )
}

function BoolChip({ value }) {
  return (
    <Chip
      label={value ? 'On' : 'Off'}
      size='small'
      sx={{
        fontSize: '0.7rem',
        height: 20,
        bgcolor: value ? '#dcfce7' : '#f1f5f9',
        color: value ? '#15803d' : '#475569',
        fontWeight: 600,
      }}
    />
  )
}

function ConfirmDialog({ open, onClose, onConfirm, loading, clinicCount, title }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='xs'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography variant='body2' color='text.secondary' lineHeight={1.7}>
          This will override the current settings for all{' '}
          <Typography component='span' variant='body2' fontWeight={600} color='text.primary'>
            {clinicCount} clinic{clinicCount !== 1 ? 's' : ''}
          </Typography>
          . Individual clinic admins will still be able to adjust these settings afterward.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button variant='outlined' onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant='contained' loading={loading} onClick={onConfirm}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}
