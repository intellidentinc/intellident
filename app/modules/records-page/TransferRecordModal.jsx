'use client'

import { useEffect, useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import { CopyPlus, Lock } from 'lucide-react'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import { useToast } from '@/app/providers/ToastProvider'
import { useCrypto } from '@/app/providers/CryptoProvider'
import { decryptRecordNotes } from '@/lib/recordCrypto'
import { encryptData, generateContentKey, importPublicKey, toBase64, wrapContentKey } from '@/lib/crypto'

function transferredTitle(title) {
  const base = title?.trim() || 'Transferred clinical record'
  const prefixed = base.startsWith('Transferred:') ? base : `Transferred: ${base}`
  return prefixed.slice(0, 200)
}

async function wrapToRecipients(cek, recipients) {
  return Promise.all(
    recipients.map(async (recipient) => ({
      userId: recipient.userId,
      wrappedKey: await wrapContentKey(cek, await importPublicKey(recipient.publicKey)),
    }))
  )
}

export default function TransferRecordModal({ open, patient, record, onClose, onRequiresUnlock }) {
  const { showToast } = useToast()
  const { privateKey } = useCrypto()

  const [clinics, setClinics] = useState([])
  const [clinicsLoading, setClinicsLoading] = useState(false)
  const [targetClinicId, setTargetClinicId] = useState('')
  const [targetPatientIdentifier, setTargetPatientIdentifier] = useState('')
  const [patientConsentConfirmed, setPatientConsentConfirmed] = useState(false)
  const [sourceClinicApprovalConfirmed, setSourceClinicApprovalConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)

  const defaultTitle = useMemo(() => transferredTitle(record?.title), [record])

  useEffect(() => {
    if (!open) return
    setTargetClinicId('')
    setTargetPatientIdentifier('')
    setPatientConsentConfirmed(false)
    setSourceClinicApprovalConfirmed(false)
    setClinicsLoading(true)
    fetch('/api/record-transfers/clinics')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setClinics(data.clinics ?? []))
      .catch(() => showToast('Failed to load destination clinics', 'error'))
      .finally(() => setClinicsLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSourceNotes() {
    const res = await fetch(`/api/records/${patient.id}/${record.id}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (data.requiresStepUp) throw new Error('Step-up authentication is required again')
      throw new Error(data.error || 'Failed to load source record')
    }

    const source = data.record
    if (!source.encryptedData || !source.dataIv) return ''
    if (!privateKey) throw new Error('UNLOCK_REQUIRED')
    if (!source.wrappedKey) throw new Error('This record is not yet shared with your key')

    const { notes } = await decryptRecordNotes({
      wrappedKey: source.wrappedKey,
      encryptedData: source.encryptedData,
      dataIv: source.dataIv,
      patientId: patient.id,
      privateKey,
    })

    if (source.contentHash) {
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(notes))
      if (toBase64(hashBuf) !== source.contentHash) throw new Error('Record integrity check failed')
    }

    return notes
  }

  async function handleTransfer() {
    if (!patient || !record) return
    if (!targetClinicId) { showToast('Choose a destination clinic', 'error'); return }
    if (!targetPatientIdentifier.trim()) { showToast('Enter the destination patient email or patient code', 'error'); return }
    if (!patientConsentConfirmed || !sourceClinicApprovalConfirmed) {
      showToast('Confirm patient consent and source clinic approval', 'error')
      return
    }
    if (!privateKey) {
      onRequiresUnlock?.()
      return
    }

    setSaving(true)
    try {
      const prepareRes = await fetch('/api/record-transfers/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePatientId: patient.id,
          sourceRecordId: record.id,
          targetClinicId,
          targetPatientIdentifier: targetPatientIdentifier.trim(),
        }),
      })
      const prepared = await prepareRes.json().catch(() => ({}))
      if (!prepareRes.ok) throw new Error(prepared.error || 'Failed to prepare transfer')

      const notes = await fetchSourceNotes()
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(notes))
      const cek = await generateContentKey()
      const { ciphertext, iv } = await encryptData(cek, notes, prepared.targetPatient.id)
      const keys = await wrapToRecipients(cek, prepared.recipients ?? [])

      const copyRes = await fetch('/api/record-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePatientId: patient.id,
          sourceRecordId: record.id,
          targetClinicId,
          targetPatientIdentifier: targetPatientIdentifier.trim(),
          title: defaultTitle,
          encryptedData: ciphertext,
          dataIv: iv,
          contentHash: toBase64(hashBuf),
          keys,
          patientConsentConfirmed,
          sourceClinicApprovalConfirmed,
        }),
      })
      const copied = await copyRes.json().catch(() => ({}))
      if (!copyRes.ok) throw new Error(copied.error || 'Failed to copy record')

      showToast('Record copied to destination clinic', 'success')
      onClose()
    } catch (err) {
      if (err.message === 'UNLOCK_REQUIRED') {
        onRequiresUnlock?.()
      } else {
        showToast(err.message || 'Failed to transfer record', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!record || !patient) return null

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth='sm'
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' } } }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
          <CopyPlus size={20} color='#2563eb' />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            Copy Record to Another Clinic
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }} noWrap>
            {record.title}
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant='body2' fontWeight={500} sx={{ mb: 0.75 }}>
            Destination clinic
          </Typography>
          <FormControl fullWidth size='small' disabled={clinicsLoading || saving}>
            <Select
              value={targetClinicId}
              displayEmpty
              onChange={(e) => setTargetClinicId(e.target.value)}
            >
              <MenuItem value='' disabled>
                <Typography variant='body2' color='text.disabled'>Select clinic</Typography>
              </MenuItem>
              {clinics.map((clinic) => (
                <MenuItem key={clinic.id} value={clinic.id}>
                  {clinic.name}{clinic.code ? ` (${clinic.code})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Input
          id='target-patient-identifier'
          label='Destination patient email or patient code'
          value={targetPatientIdentifier}
          onChange={(e) => setTargetPatientIdentifier(e.target.value)}
          disabled={saving}
          placeholder='patient@example.com or PAT-CLN-2026-00001'
        />

        <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, p: 1.5 }}>
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1 }}>
            A copied record is created in the destination clinic. Attachments stay in the source clinic.
          </Typography>
          <FormControlLabel
            control={<Checkbox size='small' checked={patientConsentConfirmed} onChange={(e) => setPatientConsentConfirmed(e.target.checked)} disabled={saving} />}
            label={<Typography variant='body2'>Patient requested and consented to this transfer</Typography>}
          />
          <FormControlLabel
            control={<Checkbox size='small' checked={sourceClinicApprovalConfirmed} onChange={(e) => setSourceClinicApprovalConfirmed(e.target.checked)} disabled={saving} />}
            label={<Typography variant='body2'>Source clinic approves releasing this record copy</Typography>}
          />
        </Box>

        {!privateKey && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fef9c3', border: '1px solid #fde68a', borderRadius: 2, px: 1.5, py: 1 }}>
            <Lock size={15} color='#92400e' />
            <Typography variant='caption' color='#92400e'>Unlock records before copying encrypted notes.</Typography>
          </Box>
        )}

        {clinicsLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} sx={{ color: '#2563eb' }} />
            <Typography variant='caption' color='text.secondary'>Loading clinics...</Typography>
          </Box>
        )}
      </Box>

      <Divider />

      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant='outlined' onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant='contained' onClick={handleTransfer} loading={saving} disabled={clinicsLoading}>
          Copy record
        </Button>
      </Box>
    </Dialog>
  )
}
