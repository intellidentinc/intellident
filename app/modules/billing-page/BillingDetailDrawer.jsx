'use client'

import { useState, useEffect } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import { X, Download, Eye, Banknote, Link2, CheckCircle2, Clock, User, Calendar, Stethoscope } from 'lucide-react'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { STATUS_PAYMENT_CHIP, BILLING_TYPE_CHIP } from './BillingPage'
import RecordPaymentModal from './RecordPaymentModal'
import ReceiptPreviewDialog from './ReceiptPreviewDialog'
import dayjs from 'dayjs'

function php(n) {
  return '₱' + Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const METHOD_CHIP = {
  CASH:     { bg: '#f0fdf4', color: '#15803d', label: 'Cash' },
  PAYMONGO: { bg: '#eff6ff', color: '#1d4ed8', label: 'Online' },
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}>
      <Icon size={14} color='#94a3b8' style={{ flexShrink: 0 }} />
      <Typography variant='caption' color='text.secondary' sx={{ width: 100, flexShrink: 0 }}>{label}</Typography>
      <Typography variant='body2' color='text.primary' fontWeight={500} sx={{ flex: 1 }}>{value ?? '—'}</Typography>
    </Box>
  )
}

export default function BillingDetailDrawer({ billing: initialBilling, clinicId, onClose }) {
  const { showToast } = useToast()

  const [billing, setBilling]         = useState(initialBilling)
  const [clinic, setClinic]           = useState(null)
  const [loadingLink, setLoadingLink] = useState(false)
  const [loadingView, setLoadingView] = useState(false)
  const [loadingPdf, setLoadingPdf]   = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [previewUrl, setPreviewUrl]   = useState(null)

  useEffect(() => {
    if (clinicId) {
      fetch(`/api/clinics/${clinicId}/profile`)
        .then(r => r.json())
        .then(setClinic)
        .catch(() => {})
    }
  }, [clinicId])

  async function refreshBilling() {
    try {
      const res  = await fetch(`/api/billing/${billing.id}`)
      const data = await res.json()
      if (data.billing) setBilling(data.billing)
    } catch {
      // silent
    }
  }

  async function handlePaymentSuccess() {
    setPayModalOpen(false)
    await refreshBilling()
    onClose(true)
  }

  async function handleSendLink() {
    setLoadingLink(true)
    try {
      const res  = await fetch(`/api/billing/${billing.id}/checkout`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate link')
      window.open(data.checkoutUrl, '_blank', 'noopener')
      showToast('Payment link opened in a new tab', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoadingLink(false)
    }
  }

  async function generateReceiptBlob() {
    const { pdf } = await import('@react-pdf/renderer')
    const BillingReceiptDocument = (await import('./BillingReceiptDocument')).default
    let logoDataUrl = null
    if (clinic?.logoUrl) {
      try {
        const res  = await fetch(clinic.logoUrl)
        const blob = await res.blob()
        logoDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch { /* skip logo on fetch failure */ }
    }
    return pdf(<BillingReceiptDocument billing={billing} clinic={{ ...clinic, logoUrl: logoDataUrl }} />).toBlob()
  }

  async function handleViewReceipt() {
    setLoadingView(true)
    try {
      const blob = await generateReceiptBlob()
      setPreviewUrl(URL.createObjectURL(blob))
    } catch {
      showToast('Failed to generate receipt preview', 'error')
    } finally {
      setLoadingView(false)
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }

  function downloadReceiptFromUrl(url) {
    const a    = document.createElement('a')
    a.href     = url
    a.download = `receipt-${billing.receiptNumber ?? billing.id}.pdf`
    a.click()
  }

  async function handleDownloadReceipt() {
    setLoadingPdf(true)
    try {
      const blob = await generateReceiptBlob()
      const url  = URL.createObjectURL(blob)
      downloadReceiptFromUrl(url)
      URL.revokeObjectURL(url)
    } catch (err) {
      showToast('Failed to generate receipt PDF', 'error')
    } finally {
      setLoadingPdf(false)
    }
  }

  const chip     = STATUS_PAYMENT_CHIP[billing.status] ?? STATUS_PAYMENT_CHIP.UNPAID
  const typeChip = BILLING_TYPE_CHIP[billing.billingType] ?? BILLING_TYPE_CHIP.SERVICE
  const patient = billing.patient
  const appt    = billing.appointment
  const balance = Number(billing.balance ?? 0)
  const canPay  = billing.status !== 'PAID' && billing.status !== 'REFUNDED'
  const canReceipt = billing.status === 'PARTIAL' || billing.status === 'PAID'

  return (
    <>
      <Drawer
        anchor='right'
        open
        onClose={() => onClose(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' } }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant='subtitle1' fontWeight={700} color='text.primary'>
                Billing Detail
              </Typography>
              <Chip
                label={typeChip.label}
                size='small'
                sx={{ bgcolor: typeChip.bg, color: typeChip.color, fontWeight: 600, fontSize: '0.72rem', height: 20 }}
              />
              <Chip
                label={chip.label}
                size='small'
                sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.72rem', height: 20 }}
              />
            </Box>
            <Typography variant='caption' color='text.secondary' sx={{ fontFamily: 'monospace' }}>
              {billing.receiptNumber ?? 'Receipt pending'}
            </Typography>
          </Box>
          <IconButton size='small' onClick={() => onClose(false)} sx={{ mt: 0.25 }}>
            <X size={16} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
          {/* Appointment info */}
          <Typography variant='caption' fontWeight={700} color='text.secondary' sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
            Appointment
          </Typography>
          <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, px: 2, py: 1.5, mb: 2.5 }}>
            <InfoRow icon={User}        label='Patient'    value={patient ? `${patient.firstName} ${patient.lastName}` : undefined} />
            <InfoRow icon={Stethoscope} label='Service'    value={appt?.service?.name} />
            <InfoRow icon={Calendar}    label='Scheduled'  value={appt?.scheduledAt ? dayjs(appt.scheduledAt).format('MMM D, YYYY h:mm A') : undefined} />
            <InfoRow icon={CheckCircle2} label='Appt. Code' value={appt?.appointmentCode} />
          </Box>

          {/* Amount summary */}
          <Typography variant='caption' fontWeight={700} color='text.secondary' sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
            Amount Summary
          </Typography>
          <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, px: 2, py: 1.5, mb: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
              <Typography variant='body2' color='text.secondary'>Service Total</Typography>
              <Typography variant='body2' color='text.primary' fontWeight={500}>{php(billing.amount)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
              <Typography variant='body2' color='text.secondary'>Amount Paid</Typography>
              <Typography variant='body2' color='success.main' fontWeight={600}>{php(billing.amountPaid)}</Typography>
            </Box>
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
              <Typography variant='body2' fontWeight={700} color='text.primary'>Outstanding Balance</Typography>
              <Typography variant='body2' fontWeight={700} color={balance > 0 ? 'error.main' : 'success.main'}>
                {php(balance)}
              </Typography>
            </Box>
          </Box>

          {/* Payment history */}
          <Typography variant='caption' fontWeight={700} color='text.secondary' sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
            Payment History
          </Typography>
          {(billing.payments ?? []).length === 0 ? (
            <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, px: 2, py: 3, textAlign: 'center', mb: 2.5 }}>
              <Typography variant='body2' color='text.disabled'>No payments recorded yet</Typography>
            </Box>
          ) : (
            <Stack spacing={1} sx={{ mb: 2.5 }}>
              {(billing.payments ?? []).map((p) => {
                const mc = METHOD_CHIP[p.method?.toUpperCase()] ?? METHOD_CHIP.CASH
                return (
                  <Box
                    key={p.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#f8fafc', borderRadius: 2, px: 2, py: 1.25 }}
                  >
                    <Clock size={14} color='#94a3b8' style={{ flexShrink: 0 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant='body2' fontWeight={600} color='text.primary'>{php(p.amount)}</Typography>
                      {p.notes && <Typography variant='caption' color='text.secondary'>{p.notes}</Typography>}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip label={mc.label} size='small' sx={{ bgcolor: mc.bg, color: mc.color, fontWeight: 600, fontSize: '0.68rem', height: 18, mb: 0.25 }} />
                      <Typography variant='caption' color='text.disabled' sx={{ display: 'block' }}>
                        {dayjs(p.paidAt).format('MMM D, YYYY')}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Stack>
          )}
        </Box>

        {/* Actions footer */}
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {canReceipt && (
            <>
              <Button
                variant='outlined'
                size='small'
                startIcon={loadingView ? undefined : <Eye size={14} />}
                loading={loadingView}
                onClick={handleViewReceipt}
                sx={{ fontSize: '0.8rem' }}
              >
                View Receipt
              </Button>
              <Button
                variant='outlined'
                size='small'
                startIcon={loadingPdf ? undefined : <Download size={14} />}
                loading={loadingPdf}
                onClick={handleDownloadReceipt}
                sx={{ fontSize: '0.8rem' }}
              >
                Download
              </Button>
            </>
          )}
          {canPay && (
            <>
              <Button
                variant='outlined'
                size='small'
                startIcon={loadingLink ? undefined : <Link2 size={14} />}
                loading={loadingLink}
                onClick={handleSendLink}
                sx={{ fontSize: '0.8rem' }}
              >
                Payment Link
              </Button>
              <Button
                variant='contained'
                size='small'
                startIcon={<Banknote size={14} />}
                onClick={() => setPayModalOpen(true)}
                sx={{ fontSize: '0.8rem', ml: 'auto' }}
              >
                Record Cash
              </Button>
            </>
          )}
        </Box>
      </Drawer>

      <RecordPaymentModal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        billing={billing}
        onSuccess={handlePaymentSuccess}
      />

      <ReceiptPreviewDialog
        open={!!previewUrl}
        blobUrl={previewUrl}
        onClose={closePreview}
        onDownload={() => previewUrl && downloadReceiptFromUrl(previewUrl)}
      />
    </>
  )
}
