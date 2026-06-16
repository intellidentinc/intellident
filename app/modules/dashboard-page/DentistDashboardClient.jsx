'use client'

import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { CalendarDays, CalendarRange, Users, CalendarX2, FileText } from 'lucide-react'
import { colors, radii, shadows } from '@/components/commons/theme'
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

const QUICK_LINKS = [
  { label: 'My Schedule',     desc: 'Day and week calendar', href: 'schedule', icon: CalendarDays },
  { label: 'Patient Records', desc: 'Browse your patients',  href: 'records',  icon: FileText },
]

export default function DentistDashboardClient({ session, todayAppts, weekAppts, totalPatients, nextAppt }) {
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
            <Typography variant='h5'>{greeting}, Dr. {session.lastName ?? session.firstName}</Typography>
            <Typography variant='body2' sx={{ color: colors.faint, mt: 0.5 }}>
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
            <StatCard label="Today's appointments" value={todayAppts}    href='schedule' icon={CalendarDays} />
            <StatCard label='Upcoming this week'   value={weekAppts}     href='schedule' icon={CalendarRange} />
            <Box sx={{ gridColumn: { xs: 'span 2', sm: 'span 1' } }}>
              <StatCard label='My patients'        value={totalPatients} href='records'  icon={Users} />
            </Box>
          </Box>
        </motion.div>

        {/* Bottom: next patient + quick links */}
        <motion.div variants={fadeUp}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>

            {/* Next patient */}
            <SectionCard
              title='Next Patient'
              icon={Users}
              action={timeUntil && nextAppt && (
                <Typography variant='caption' sx={{ fontWeight: 600, color: colors.primaryBlue, bgcolor: colors.paleBlue, px: 1.25, py: 0.25, borderRadius: 1, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                  {timeUntil}
                </Typography>
              )}
            >
              {nextAppt ? (
                <Box>
                  <Typography variant='h6' sx={{ lineHeight: 1.3 }}>{nextAppt.patientName}</Typography>
                  <Typography variant='body2' sx={{ color: colors.muted, mt: 0.75 }}>{nextAppt.serviceName}</Typography>
                  <Typography variant='body2' sx={{ color: colors.muted }}>{nextAppt.scheduledAtFormatted}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2.5, pt: 2, borderTop: `1px solid ${colors.surface}` }}>
                    <StatusChip status={nextAppt.status} />
                    <Box component='a' href='schedule' sx={{ fontSize: '0.8rem', fontWeight: 600, color: colors.primaryBlue, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      View full schedule →
                    </Box>
                  </Box>
                </Box>
              ) : (
                <EmptyState icon={CalendarX2} title='No upcoming appointments' description='Your schedule is clear.' />
              )}
            </SectionCard>

            {/* Quick links */}
            <SectionCard title='Quick Actions' icon={CalendarRange} noPadding>
              <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {QUICK_LINKS.map((link) => (
                  <Box
                    key={link.href}
                    component='a'
                    href={link.href}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.75, textDecoration: 'none',
                      bgcolor: '#fff', border: `1px solid ${colors.border}`, borderRadius: `${radii.md}px`, p: 2,
                      transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
                      '&:hover': { borderColor: colors.borderStrong, boxShadow: shadows.hover, transform: 'translateY(-2px)' },
                    }}
                  >
                    <Box sx={{
                      width: 36, height: 36, borderRadius: `${radii.sm}px`, flexShrink: 0,
                      bgcolor: colors.paleBlue, color: colors.primaryBlue,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <link.icon size={17} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant='body2' fontWeight={600} color={colors.ink}>{link.label}</Typography>
                      <Typography variant='caption' sx={{ color: colors.faint }}>{link.desc}</Typography>
                    </Box>
                    <Typography sx={{ color: colors.faint, fontSize: '1rem', lineHeight: 1 }}>→</Typography>
                  </Box>
                ))}
              </Box>
            </SectionCard>

          </Box>
        </motion.div>

      </motion.div>
    </PageContainer>
  )
}
