'use client'

import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { CalendarDays, CheckCircle, Clock, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { colors, radii } from '@/components/commons/theme'
import StatCard from '@/components/commons/StatCard'
import SectionCard from '@/components/commons/SectionCard'
import EmptyState from '@/components/commons/EmptyState'
import PageContainer from '@/components/commons/PageContainer'
import StatusChip from '@/components/commons/statusColors'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getTimeUntil(isoDate) {
  const diff = new Date(isoDate) - new Date()
  if (diff < 0) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 1) return `In ${days} days`
  if (days === 1) return 'Tomorrow'
  if (hours > 0) return `In ${hours}h`
  return 'Coming up soon'
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const BookButton = ({ children }) => (
  <Box component='a' href='schedules?book=1' sx={{
    display: 'inline-flex', alignItems: 'center',
    px: 3, py: 1, bgcolor: colors.primaryBlue, color: '#fff',
    borderRadius: `${radii.sm}px`, fontWeight: 600, fontSize: '0.8rem',
    textDecoration: 'none', transition: 'background 0.15s',
    '&:hover': { bgcolor: colors.primaryDark },
  }}>
    {children}
  </Box>
)

export default function PatientDashboardClient({ session, nextAppt, upcoming, completed, cancelled }) {
  const [greeting, setGreeting] = useState('Hello')
  const [timeUntil, setTimeUntil] = useState(null)

  useEffect(() => {
    setGreeting(getGreeting())
    if (nextAppt?.scheduledAtRaw) setTimeUntil(getTimeUntil(nextAppt.scheduledAtRaw))
  }, [nextAppt])

  return (
    <PageContainer>
      <motion.div variants={stagger} initial='hidden' animate='visible'>

        {/* Hero */}
        <motion.div variants={fadeUp}>
          <Box sx={{ mb: 4 }}>
            <Typography variant='h5'>{greeting}, {session.firstName}</Typography>
            <Typography variant='body2' sx={{ color: colors.faint, mt: 0.5 }}>
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>
        </motion.div>

        {/* Next appointment */}
        <motion.div variants={fadeUp}>
          <Box sx={{ mb: 3 }}>
            {nextAppt ? (
              <SectionCard
                title='Next Appointment'
                icon={CalendarDays}
                action={timeUntil && (
                  <Typography variant='caption' sx={{ fontWeight: 600, color: colors.primaryBlue, bgcolor: colors.paleBlue, px: 1.25, py: 0.25, borderRadius: 1, fontSize: '0.72rem' }}>
                    {timeUntil}
                  </Typography>
                )}
              >
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant='h6' sx={{ lineHeight: 1.3 }}>{nextAppt.serviceName}</Typography>
                    <Typography variant='body2' sx={{ color: colors.muted, mt: 0.75 }}>{nextAppt.scheduledAtFormatted}</Typography>
                    {nextAppt.dentistName && (
                      <Typography variant='body2' sx={{ color: colors.muted }}>Dr. {nextAppt.dentistName}</Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
                    <StatusChip status={nextAppt.status} />
                    <Box component='a' href='schedules' sx={{ fontSize: '0.8rem', fontWeight: 600, color: colors.primaryBlue, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      View all →
                    </Box>
                  </Box>
                </Box>
              </SectionCard>
            ) : (
              <Box sx={{ border: `1px dashed ${colors.border}`, borderRadius: `${radii.lg}px`, bgcolor: '#fff' }}>
                <EmptyState
                  icon={CalendarDays}
                  title='No upcoming appointments'
                  description='Book your next dental visit to get started.'
                  action={<BookButton>Book Appointment</BookButton>}
                />
              </Box>
            )}
          </Box>
        </motion.div>

        {/* Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          <StatCard icon={Clock} label='Upcoming' value={upcoming} />
          <StatCard icon={CheckCircle} label='Completed' value={completed} accent='#15803d' accentBg='#dcfce7' />
          <Box sx={{ gridColumn: { xs: 'span 2', sm: 'span 1' } }}>
            <StatCard icon={XCircle} label='Cancelled' value={cancelled} accent='#b91c1c' accentBg='#fee2e2' />
          </Box>
        </Box>

        {/* Book more */}
        {nextAppt && (
          <motion.div variants={fadeUp}>
            <Box sx={{
              bgcolor: '#fff', border: `1px solid ${colors.border}`, borderRadius: `${radii.lg}px`,
              px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 2, flexWrap: 'wrap',
            }}>
              <Typography variant='body2' sx={{ color: colors.muted }}>Need to schedule another visit?</Typography>
              <BookButton>Book Appointment</BookButton>
            </Box>
          </motion.div>
        )}

      </motion.div>
    </PageContainer>
  )
}
