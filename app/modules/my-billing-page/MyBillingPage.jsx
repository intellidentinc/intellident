'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import Button from '@/components/commons/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { Download, CreditCard, Clock, CheckCircle2, Eye } from 'lucide-react'
import ReceiptPreviewDialog from '@/app/modules/billing-page/ReceiptPreviewDialog'
import dayjs from 'dayjs'

const STATUS_CHIP = {
  UNPAID:   { bg: '#fee2e2', color: '#b91c1c', label: 'Unpaid' },
  PARTIAL:  { bg: '#fef3c7', color: '#92400e', label: 'Partial' },
  PAID:     { bg: '#dcfce7', color: '#15803d', label: 'Paid' },
  REFUNDED: { bg: '#f3e8ff', color: '#7c3aed', label: 'Refunded' },
}

function php(n) {
  return '₱' + Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function BillingCard({ billing, onPay, onView, onDownload, paying, viewingId, downloadingId }) {
  const chip    = STATUS_CHIP[billing.status] ?? STATUS_CHIP.UNPAID
  const appt    = billing.appointment
  const settled = billing.status === 'PAID' || billing.status === 'REFUNDED'

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, bgcolor: '#fff', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Top row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant='subtitle2' fontWeight={700} color='text.primary'>
            {appt?.service?.name ?? 'Dental Service'}
          </Typography>
          <Typography variant='caption' color='text.secondary' sx={{ fontFamily: 'monospace' }}>
            {appt?.appointmentCode ?? '—'}
          </Typography>
        </Box>
        <Chip
          label={chip.label}
          size='small'
          sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.72rem', height: 22 }}
        />
      </Box>

      {/* Date */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Clock size={13} color='#94a3b8' />
        <Typography variant='caption' color='text.secondary'>
          {appt?.scheduledAt ? dayjs(appt.scheduledAt).format('MMMM D, YYYY · h:mm A') : '—'}
        </Typography>
      </Box>

      <Divider />

      {/* Amounts */}
      <Box sx={{ display: 'flex', gap: 3 }}>
        <Box>
          <Typography variant='caption' color='text.secondary'>Total</Typography>
          <Typography variant='body2' fontWeight={600} color='text.primary'>{php(billing.amount)}</Typography>
        </Box>
        <Box>
          <Typography variant='caption' color='text.secondary'>Paid</Typography>
          <Typography variant='body2' fontWeight={600} color='success.main'>{php(billing.amountPaid)}</Typography>
        </Box>
        {billing.balance > 0 && (
          <Box>
            <Typography variant='caption' color='text.secondary'>Balance Due</Typography>
            <Typography variant='body2' fontWeight={700} color='error.main'>{php(billing.balance)}</Typography>
          </Box>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
        {!settled && (
          <Button
            variant='contained'
            size='small'
            startIcon={paying === billing.id ? undefined : <CreditCard size={14} />}
            loading={paying === billing.id}
            onClick={() => onPay(billing)}
            sx={{ fontSize: '0.8rem' }}
          >
            Pay Now
          </Button>
        )}
        {(billing.status === 'PARTIAL' || billing.status === 'PAID') && (
          <>
            <Button
              variant='outlined'
              size='small'
              startIcon={viewingId === billing.id ? undefined : <Eye size={14} />}
              loading={viewingId === billing.id}
              onClick={() => onView(billing)}
              sx={{ fontSize: '0.8rem' }}
            >
              View Receipt
            </Button>
            <Button
              variant='outlined'
              size='small'
              startIcon={downloadingId === billing.id ? undefined : <Download size={14} />}
              loading={downloadingId === billing.id}
              onClick={() => onDownload(billing)}
              sx={{ fontSize: '0.8rem' }}
            >
              Download
            </Button>
          </>
        )}
      </Box>
    </Box>
  )
}

export default function MyBillingPage() {
  const { clinicId }   = useParams()
  const searchParams   = useSearchParams()
  const router         = useRouter()
  const { showToast }  = useToast()

  const [billings, setBillings]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [clinic, setClinic]             = useState(null)
  const [paying, setPaying]             = useState(null)
  const [viewingId, setViewingId]       = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [showSuccess, setShowSuccess]   = useState(false)
  const [preview, setPreview]           = useState(null) // { billing, blobUrl }

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowSuccess(true)
      // Strip query param without re-render loop
      router.replace(`/${clinicId}/my-billing`, { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([
      fetch('/api/patient/billing').then(r => r.json()),
      fetch(`/api/clinics/${clinicId}/profile`).then(r => r.json()),
    ])
      .then(([billData, clinicData]) => {
        setBillings(billData.billings ?? [])
        setClinic(clinicData)
      })
      .catch(() => showToast('Failed to load billing data', 'error'))
      .finally(() => setLoading(false))
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePay(billing) {
    setPaying(billing.id)
    try {
      const res  = await fetch(`/api/billing/${billing.id}/checkout`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to initiate payment')
      window.location.href = data.checkoutUrl
    } catch (err) {
      showToast(err.message, 'error')
      setPaying(null)
    }
  }

  async function generateReceiptBlob(billing) {
    const { pdf } = await import('@react-pdf/renderer')
    const BillingReceiptDocument = (await import('@/app/modules/billing-page/BillingReceiptDocument')).default
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

  async function handleView(billing) {
    setViewingId(billing.id)
    try {
      const blob = await generateReceiptBlob(billing)
      const blobUrl = URL.createObjectURL(blob)
      setPreview({ billing, blobUrl })
    } catch {
      showToast('Failed to generate receipt preview', 'error')
    } finally {
      setViewingId(null)
    }
  }

  function closePreview() {
    if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl)
    setPreview(null)
  }

  function downloadBlobUrl(blobUrl, billing) {
    const a    = document.createElement('a')
    a.href     = blobUrl
    a.download = `receipt-${billing.receiptNumber ?? billing.id}.pdf`
    a.click()
  }

  async function handleDownload(billing) {
    setDownloadingId(billing.id)
    try {
      const blob = await generateReceiptBlob(billing)
      const url  = URL.createObjectURL(blob)
      downloadBlobUrl(url, billing)
      URL.revokeObjectURL(url)
    } catch {
      showToast('Failed to generate receipt', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  const outstanding = billings.filter(b => b.status === 'UNPAID' || b.status === 'PARTIAL')
  const settled     = billings.filter(b => b.status === 'PAID' || b.status === 'REFUNDED')

  return (
    <SidebarInset>
      <PageHeader title='My Bills' />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, maxWidth: 720 }}>
        <Typography variant='h5' fontWeight={700} color='text.primary' gutterBottom>
          My Bills
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          View and pay your outstanding balances from your dental appointments.
        </Typography>

        {showSuccess && (
          <Alert
            severity='success'
            icon={<CheckCircle2 size={18} />}
            onClose={() => setShowSuccess(false)}
            sx={{ mb: 3, borderRadius: 2 }}
          >
            Your payment was received successfully! It may take a moment to reflect.
          </Alert>
        )}

        {/* Outstanding Bills */}
        <Typography variant='h6' fontWeight={700} color='text.primary' sx={{ mb: 1.5 }}>
          Outstanding Bills
        </Typography>

        {loading ? (
          <Stack spacing={2} sx={{ mb: 4 }}>
            {[1, 2].map(i => <Skeleton key={i} variant='rounded' height={160} />)}
          </Stack>
        ) : outstanding.length === 0 ? (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 4, textAlign: 'center', bgcolor: '#f8fafc', mb: 4 }}>
            <CheckCircle2 size={32} color='#86efac' style={{ marginBottom: 8 }} />
            <Typography variant='body2' color='text.secondary'>You have no outstanding bills.</Typography>
          </Box>
        ) : (
          <Stack spacing={2} sx={{ mb: 4 }}>
            {outstanding.map(b => (
              <BillingCard
                key={b.id}
                billing={b}
                onPay={handlePay}
                onView={handleView}
                onDownload={handleDownload}
                paying={paying}
                viewingId={viewingId}
                downloadingId={downloadingId}
              />
            ))}
          </Stack>
        )}

        <Divider sx={{ mb: 3 }} />

        {/* Payment History */}
        <Typography variant='h6' fontWeight={700} color='text.primary' sx={{ mb: 1.5 }}>
          Payment History
        </Typography>

        {loading ? (
          <Stack spacing={2}>
            {[1, 2].map(i => <Skeleton key={i} variant='rounded' height={140} />)}
          </Stack>
        ) : settled.length === 0 ? (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 4, textAlign: 'center', bgcolor: '#f8fafc' }}>
            <Typography variant='body2' color='text.secondary'>No completed payments yet.</Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {settled.map(b => (
              <BillingCard
                key={b.id}
                billing={b}
                onPay={handlePay}
                onView={handleView}
                onDownload={handleDownload}
                paying={paying}
                viewingId={viewingId}
                downloadingId={downloadingId}
              />
            ))}
          </Stack>
        )}
      </Box>

      <ReceiptPreviewDialog
        open={!!preview}
        blobUrl={preview?.blobUrl}
        onClose={closePreview}
        onDownload={() => preview && downloadBlobUrl(preview.blobUrl, preview.billing)}
      />
    </SidebarInset>
  )
}
