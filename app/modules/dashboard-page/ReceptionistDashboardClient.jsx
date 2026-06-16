'use client'

import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AlertTriangle, Clock, CalendarDays, CalendarCheck, Users, CreditCard, User, ArrowRight, ChevronRight, CalendarX2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
}

function getInitials(name) {
  const parts = (name ?? '').trim().split(' ')
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

const QUICK_LINKS = [
  { label: 'Appointments', desc: 'View & manage all',   href: 'appointments', icon: CalendarDays },
  { label: 'Patients',     desc: 'Patient directory',   href: 'patients',     icon: Users },
  { label: 'Billing',      desc: 'Payments & invoices', href: 'billing',      icon: CreditCard },
  { label: 'My Profile',   desc: 'Account settings',    href: 'profile',      icon: User },
]

export default function ReceptionistDashboardClient({ session, pending, todayTotal, todayConfirmed, totalPatients, recentAppts }) {
  const [greeting, setGreeting] = useState('Hello')
  useEffect(() => { setGreeting(getGreeting()) }, [])

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

        {/* Stats */}
        <motion.div variants={fadeUp}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
            <StatCard label='Pending bookings'      value={pending}        href='appointments' icon={Clock} urgent />
            <StatCard label="Today's appointments"  value={todayTotal}     href='appointments' icon={CalendarDays} />
            <StatCard label='Confirmed upcoming'    value={todayConfirmed} href='appointments' icon={CalendarCheck} />
            <StatCard label='Total patients'        value={totalPatients}  href='patients'     icon={Users} />
          </Box>
        </motion.div>

        {/* Pending alert */}
        {pending > 0 && (
          <motion.div variants={fadeUp}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 1.5,
              border: '1px solid #fde68a', borderLeft: '3px solid #d97706',
              borderRadius: `${radii.md}px`, p: 2, mb: 3, bgcolor: '#fffbeb',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <AlertTriangle size={16} color='#d97706' />
                <Typography variant='body2' fontWeight={600} sx={{ color: '#92400e' }}>
                  {pending} booking request{pending > 1 ? 's' : ''} need your attention
                </Typography>
              </Box>
              <Box component='a' href='appointments' sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5,
                px: 2.5, py: 0.75, bgcolor: '#d97706', color: '#fff',
                borderRadius: `${radii.sm}px`, fontWeight: 600, fontSize: '0.78rem',
                textDecoration: 'none', whiteSpace: 'nowrap',
                transition: 'background 0.15s', '&:hover': { bgcolor: '#b45309' },
              }}>
                Review now <ArrowRight size={14} />
              </Box>
            </Box>
          </motion.div>
        )}

        {/* Bottom: recent appointments + quick links */}
        <motion.div variants={fadeUp}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' }, gap: 3 }}>

            {/* Recent appointments */}
            <SectionCard
              title='Recent Appointments'
              icon={CalendarDays}
              noPadding
              action={
                <Box component='a' href='appointments' sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.25,
                  fontSize: '0.78rem', fontWeight: 600, color: colors.primaryBlue,
                  textDecoration: 'none', '&:hover': { textDecoration: 'underline' },
                }}>
                  View all <ChevronRight size={14} />
                </Box>
              }
            >
              {recentAppts.length === 0 ? (
                <EmptyState icon={CalendarX2} title='No appointments yet' description='New bookings will show up here.' />
              ) : (
                recentAppts.map((a, i) => (
                  <Box
                    key={a.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.75,
                      borderBottom: i < recentAppts.length - 1 ? `1px solid ${colors.surface}` : 'none',
                      transition: 'background 0.12s', '&:hover': { bgcolor: colors.surface },
                    }}
                  >
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      bgcolor: colors.paleBlue, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: colors.primaryBlue }}>
                        {getInitials(a.patientName)}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant='body2' fontWeight={600} color={colors.ink} noWrap>{a.patientName}</Typography>
                      <Typography variant='caption' sx={{ color: colors.faint }} noWrap>
                        {a.serviceName} · {a.dateFormatted}
                      </Typography>
                    </Box>
                    <StatusChip status={a.status} sx={{ flexShrink: 0 }} />
                  </Box>
                ))
              )}
            </SectionCard>

            {/* Quick links */}
            <SectionCard title='Quick Actions' icon={ArrowRight} noPadding>
              <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {QUICK_LINKS.map((link) => (
                  <Box
                    key={link.href}
                    component='a'
                    href={link.href}
                    sx={{
                      display: 'flex', flexDirection: 'column', gap: 0.75, textDecoration: 'none',
                      bgcolor: '#fff', border: `1px solid ${colors.border}`, borderRadius: `${radii.md}px`, p: 1.75,
                      transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
                      '&:hover': { borderColor: colors.borderStrong, boxShadow: shadows.hover, transform: 'translateY(-2px)' },
                    }}
                  >
                    <Box sx={{
                      width: 32, height: 32, borderRadius: `${radii.sm}px`,
                      bgcolor: colors.paleBlue, color: colors.primaryBlue,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <link.icon size={16} />
                    </Box>
                    <Box>
                      <Typography variant='body2' fontWeight={600} color={colors.ink}>{link.label}</Typography>
                      <Typography variant='caption' sx={{ color: colors.faint, display: 'block' }}>{link.desc}</Typography>
                    </Box>
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
