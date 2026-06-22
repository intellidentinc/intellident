'use client'

import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Skeleton from '@mui/material/Skeleton'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { useToast } from '@/app/providers/ToastProvider'
import { useCrypto } from '@/app/providers/CryptoProvider'
import OtpStepUpModal from '@/components/commons/OtpStepUpModal'
import UnlockRecordsModal from '@/components/commons/UnlockRecordsModal'
import { FileText, CalendarCheck, Stethoscope, Eye } from 'lucide-react'
import dayjs from 'dayjs'
import RecordViewModal from './RecordViewModal'

const STATUS_CHIP = {
  ACTIVE:   { label: 'Active',   bg: '#dcfce7', color: '#15803d' },
  ARCHIVED: { label: 'Archived', bg: '#f1f5f9', color: '#475569' },
}

const APPT_CHIP = {
  COMPLETED: { label: 'Completed', bg: '#dcfce7', color: '#15803d' },
  CONFIRMED: { label: 'Confirmed', bg: '#dbeafe', color: '#1d4ed8' },
}

export default function MyRecordsPage() {
  const { showToast } = useToast()
  const { privateKey } = useCrypto()
  const [tab, setTab] = useState(0)
  const [records, setRecords] = useState([])
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)

  const [stepUpOpen, setStepUpOpen] = useState(true)
  const [stepUpGranted, setStepUpGranted] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)

  function loadRecords() {
    setLoading(true)
    fetch('/api/patient/records')
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          if (data.requiresStepUp) {
            setStepUpGranted(false)
            setStepUpOpen(true)
          } else {
            showToast('Failed to load records', 'error')
          }
          return
        }
        const data = await r.json()
        setRecords(data.records ?? [])
        setVisits(data.visits ?? [])
      })
      .catch(() => showToast('Failed to load records', 'error'))
      .finally(() => setLoading(false))
  }

  // Load records once step-up is granted
  useEffect(() => {
    if (stepUpGranted) loadRecords()
  }, [stepUpGranted]) // eslint-disable-line react-hooks/exhaustive-deps

  // The E2EE keys live only in memory and are lost on a page reload. Once the user
  // is past step-up, prompt for a password re-unlock if the keys are missing so
  // record decryption works without forcing a full (and looping) re-login.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stepUpGranted && !privateKey) setUnlockOpen(true)
  }, [stepUpGranted, privateKey])

  return (
    <SidebarInset>
      <PageHeader title='My Dental Records' />

      <OtpStepUpModal
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onSuccess={() => { setStepUpOpen(false); setStepUpGranted(true) }}
        description='Viewing your dental records requires identity verification.'
      />

      <UnlockRecordsModal
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => setUnlockOpen(false)}
      />

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        <Typography variant='h5' fontWeight={700} color='text.primary' gutterBottom>
          My Dental Records
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          View your dental records and visit history.
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label='Clinical Records' icon={<FileText size={16} />} iconPosition='start' />
          <Tab label='Visit History' icon={<CalendarCheck size={16} />} iconPosition='start' />
        </Tabs>

        {/* Clinical Records Tab */}
        {tab === 0 && (
          <Box>
            {!stepUpGranted || loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[1, 2, 3].map((n) => <Skeleton key={n} variant='rounded' height={80} />)}
              </Box>
            ) : records.length === 0 ? (
              <EmptyState
                icon={<FileText size={40} color='#94a3b8' />}
                message='No clinical records yet'
                sub='Your dentist will add records after your visit.'
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {records.map((rec) => {
                  const chip = STATUS_CHIP[rec.status] ?? STATUS_CHIP.ACTIVE
                  return (
                    <Box
                      key={rec.id}
                      sx={{
                        p: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <Box
                        sx={{
                          width: 40, height: 40, borderRadius: 2,
                          bgcolor: '#eff6ff', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}
                      >
                        <FileText size={20} color='#2563eb' />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='body2' fontWeight={600} noWrap>
                          {rec.title}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          Added {dayjs(rec.createdAt).format('MMM D, YYYY')}
                          {rec.updatedAt !== rec.createdAt && ` · Updated ${dayjs(rec.updatedAt).format('MMM D, YYYY')}`}
                        </Typography>
                      </Box>
                      <Chip
                        label={chip.label}
                        size='small'
                        sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.7rem', mr: 0.5 }}
                      />
                      <Box
                        component='button'
                        onClick={() => setViewRecord(rec)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.5,
                          px: 1.25, py: 0.6, border: '1px solid', borderColor: '#dbeafe',
                          borderRadius: 1.5, bgcolor: '#eff6ff', cursor: 'pointer',
                          color: '#2563eb', fontSize: '0.75rem', fontWeight: 600,
                          flexShrink: 0, transition: 'all 0.15s',
                          '&:hover': { bgcolor: '#dbeafe', borderColor: '#93c5fd' },
                        }}
                      >
                        <Eye size={13} />
                        View
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>
        )}

        {/* Visit History Tab */}
        {tab === 1 && (
          <Box>
            {!stepUpGranted || loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[1, 2, 3].map((n) => <Skeleton key={n} variant='rounded' height={100} />)}
              </Box>
            ) : visits.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck size={40} color='#94a3b8' />}
                message='No visit history yet'
                sub='Your completed appointments will appear here.'
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visits.map((visit) => {
                  const chip = APPT_CHIP[visit.status] ?? APPT_CHIP.COMPLETED
                  const dentistName = visit.dentist
                    ? `Dr. ${visit.dentist.user.firstName} ${visit.dentist.user.lastName}`
                    : 'Any Available'
                  return (
                    <Box
                      key={visit.id}
                      sx={{
                        p: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Box
                          sx={{
                            width: 40, height: 40, borderRadius: 2,
                            bgcolor: '#f0fdf4', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}
                        >
                          <Stethoscope size={20} color='#15803d' />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant='body2' fontWeight={600}>
                              {visit.service?.name ?? 'Appointment'}
                            </Typography>
                            <Chip
                              label={chip.label}
                              size='small'
                              sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.7rem' }}
                            />
                          </Box>
                          <Typography variant='caption' color='text.secondary' display='block'>
                            {dayjs(visit.scheduledAt).format('MMM D, YYYY · h:mm A')} · {dentistName}
                          </Typography>
                          {visit.appointmentCode && (
                            <Typography variant='caption' color='text.secondary' display='block'>
                              Ref: {visit.appointmentCode}
                            </Typography>
                          )}
                          {visit.notes && (
                            <Typography variant='body2' color='text.secondary' sx={{ mt: 1, fontSize: '0.8rem' }}>
                              {visit.notes}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>
        )}
      </Box>

      <RecordViewModal
        open={!!viewRecord}
        record={viewRecord}
        onClose={() => setViewRecord(null)}
        onRequiresStepUp={() => { setViewRecord(null); setStepUpGranted(false); setStepUpOpen(true) }}
        onRequiresUnlock={() => setUnlockOpen(true)}
      />
    </SidebarInset>
  )
}

function EmptyState({ icon, message, sub }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
      <Box sx={{ mb: 2 }}>{icon}</Box>
      <Typography variant='body1' fontWeight={600} color='text.secondary' gutterBottom>
        {message}
      </Typography>
      <Typography variant='body2' color='text.disabled'>
        {sub}
      </Typography>
    </Box>
  )
}
