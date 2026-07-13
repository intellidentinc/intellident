'use client'

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import Button from '@/components/commons/Button'
import OtpStepUpModal from '@/components/commons/OtpStepUpModal'
import UnlockRecordsModal from '@/components/commons/UnlockRecordsModal'
import { useToast } from '@/app/providers/ToastProvider'
import { useCrypto } from '@/app/providers/CryptoProvider'
import { decryptRecordNotes } from '@/lib/recordCrypto'
import { encryptData, generateContentKey, importPublicKey, toBase64, wrapContentKey } from '@/lib/crypto'

const LABELS = { READY: 'Ready', PROCESSING: 'Processing', COMPLETED: 'Completed', FAILED: 'Needs retry', EXPIRED: 'Expired' }

export default function RecordTransfersPage() {
  const { showToast } = useToast()
  const { privateKey } = useCrypto()
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  const [stepUpOpen, setStepUpOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/record-transfers')
      if (!res.ok) throw new Error()
      setTransfers((await res.json()).transfers ?? [])
    } catch { showToast('Failed to load approved transfers', 'error') }
    finally { setLoading(false) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function execute(transfer) {
    if (!privateKey) { setUnlockOpen(true); return }
    setProcessingId(transfer.id)
    try {
      const prepareRes = await fetch('/api/record-transfers/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transferId: transfer.id }) })
      const prepared = await prepareRes.json().catch(() => ({}))
      if (!prepareRes.ok) {
        if (prepared.requiresStepUp) setStepUpOpen(true)
        throw new Error(prepared.error || 'Could not prepare transfer')
      }
      const records = []
      for (const source of prepared.records) {
        const notes = source.encryptedData
          ? (await decryptRecordNotes({ wrappedKey: source.wrappedKey, encryptedData: source.encryptedData, dataIv: source.dataIv, patientId: prepared.transfer.sourcePatientId, privateKey })).notes
          : ''
        if (source.contentHash) {
          const sourceHash = toBase64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(notes)))
          if (sourceHash !== source.contentHash) throw new Error(`Integrity check failed for ${source.title}`)
        }
        const cek = await generateContentKey()
        const encrypted = await encryptData(cek, notes, prepared.transfer.destinationPatient.id)
        const keys = await Promise.all(prepared.recipients.map(async (recipient) => ({ userId: recipient.userId, wrappedKey: await wrapContentKey(cek, await importPublicKey(recipient.publicKey)) })))
        records.push({ sourceRecordId: source.id, title: source.title, encryptedData: encrypted.ciphertext, dataIv: encrypted.iv, contentHash: toBase64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(notes))), keys })
      }
      const completeRes = await fetch('/api/record-transfers/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transferId: transfer.id, records }) })
      const completed = await completeRes.json().catch(() => ({}))
      if (!completeRes.ok) throw new Error(completed.error || 'Transfer failed')
      showToast(`${records.length} record${records.length === 1 ? '' : 's'} transferred successfully`, 'success')
      await load()
    } catch (error) {
      showToast(error.message || 'Transfer failed', 'error')
    } finally { setProcessingId(null) }
  }

  return <SidebarInset>
    <PageHeader title='Approved Transfers' />
    <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
      <Typography variant='h5' fontWeight={700}>Approved Record Transfers</Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>Process patient-requested transfers that both clinics have approved.</Typography>
      {loading ? <Typography color='text.secondary'>Loading...</Typography> : transfers.length === 0 ? <Paper variant='outlined' sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}><Typography color='text.secondary'>No transfers are assigned to you.</Typography></Paper> :
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {transfers.map((transfer) => <Paper key={transfer.id} variant='outlined' sx={{ p: 2.5, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
              <Box>
                <Typography fontWeight={650}>{transfer.sourcePatient.firstName} {transfer.sourcePatient.lastName}</Typography>
                <Typography variant='body2' color='text.secondary'>{transfer.sourceClinic.name} → {transfer.destinationClinic.name}</Typography>
              </Box>
              <Chip size='small' label={LABELS[transfer.status] ?? transfer.status} color={transfer.status === 'READY' ? 'success' : transfer.status === 'FAILED' ? 'error' : 'default'} />
            </Box>
            <Divider sx={{ my: 1.5 }} />
            {transfer.items.map((item) => <Typography key={item.id} variant='body2' sx={{ py: 0.25 }}>• {item.sourceRecord.title}{item.sourceRecord._count.attachments ? ` (${item.sourceRecord._count.attachments} attachment(s))` : ''}</Typography>)}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant='contained' disabled={!['READY', 'FAILED'].includes(transfer.status)} loading={processingId === transfer.id} onClick={() => execute(transfer)}>Transfer approved records</Button>
            </Box>
          </Paper>)}
        </Box>}
    </Box>
    <OtpStepUpModal open={stepUpOpen} onClose={() => setStepUpOpen(false)} onSuccess={() => setStepUpOpen(false)} description='Transferring dental records requires identity verification.' />
    <UnlockRecordsModal open={unlockOpen} onClose={() => setUnlockOpen(false)} onUnlocked={() => setUnlockOpen(false)} />
  </SidebarInset>
}
