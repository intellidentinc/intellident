'use client'

import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function useCounter(target, duration = 800) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!target) { setCount(0); return }
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.floor(eased * target))
      if (p < 1) requestAnimationFrame(tick)
      else setCount(target)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return count
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const STATUS_CHIP = {
  PENDING:     { bg: '#fef9c3', color: '#854d0e',  label: 'Pending' },
  CONFIRMED:   { bg: '#dbeafe', color: '#1d4ed8',  label: 'Confirmed' },
  COMPLETED:   { bg: '#dcfce7', color: '#15803d',  label: 'Completed' },
  CANCELLED:   { bg: '#fee2e2', color: '#b91c1c',  label: 'Cancelled' },
  NO_SHOW:     { bg: '#f1f5f9', color: '#475569',  label: 'No-show' },
  RESCHEDULED: { bg: '#ede9fe', color: '#7c3aed',  label: 'Rescheduled' },
}

function getInitials(name) {
  const parts = (name ?? '').trim().split(' ')
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

function StatCard({ label, value, href, urgent }) {
  const count = useCounter(value)
  const inner = (
    <Box sx={{
      bgcolor: '#fff',
      border: '1px solid',
      borderColor: urgent && value > 0 ? '#fde68a' : '#e2e8f0',
      borderLeft: urgent && value > 0 ? '3px solid #d97706' : undefined,
      borderRadius: 2.5,
      p: 2.5,
      height: '100%',
      transition: 'border-color 0.18s, box-shadow 0.18s',
      '&:hover': { borderColor: urgent && value > 0 ? '#fbbf24' : '#cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }}>
      <Typography
        variant='h4'
        fontWeight={800}
        sx={{ lineHeight: 1, letterSpacing: -0.5, mb: 0.5, color: urgent && value > 0 ? '#b45309' : '#0f172a' }}
      >
        {count}
      </Typography>
      <Typography variant='body2' sx={{ color: '#64748b' }}>{label}</Typography>
    </Box>
  )
  if (href) return <Box component='a' href={href} sx={{ textDecoration: 'none', display: 'block', height: '100%' }}>{inner}</Box>
  return inner
}

export default function ReceptionistDashboardClient({ session, pending, todayTotal, todayConfirmed, totalPatients, recentAppts }) {
  const [greeting, setGreeting] = useState('Hello')
  useEffect(() => { setGreeting(getGreeting()) }, [])

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <motion.div variants={stagger} initial='hidden' animate='visible'>

        {/* Hero */}
        <motion.div variants={fadeUp}>
          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight={700} color='#0f172a' sx={{ letterSpacing: -0.3 }}>
              {greeting}, {session.firstName}
            </Typography>
            <Typography variant='body2' sx={{ color: '#94a3b8', mt: 0.5 }}>
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
            <StatCard label='Pending bookings'   value={pending}        href='appointments' urgent />
            <StatCard label="Today's appointments" value={todayTotal}   href='appointments' />
            <StatCard label='Confirmed upcoming'  value={todayConfirmed} href='appointments' />
            <StatCard label='Total patients'      value={totalPatients}  href='patients' />
          </Box>
        </motion.div>

        {/* Pending alert */}
        {pending > 0 && (
          <motion.div variants={fadeUp}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 1.5,
              border: '1px solid #fde68a', borderLeft: '3px solid #d97706',
              borderRadius: 2.5, p: 2, mb: 3, bgcolor: '#fffbeb',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <AlertTriangle size={16} color='#d97706' />
                <Typography variant='body2' fontWeight={600} sx={{ color: '#92400e' }}>
                  {pending} booking request{pending > 1 ? 's' : ''} need your attention
                </Typography>
              </Box>
              <Box component='a' href='appointments' sx={{
                px: 2.5, py: 0.75, bgcolor: '#d97706', color: '#fff',
                borderRadius: 1.5, fontWeight: 600, fontSize: '0.78rem',
                textDecoration: 'none', whiteSpace: 'nowrap',
                transition: 'background 0.15s', '&:hover': { bgcolor: '#b45309' },
              }}>
                Review now
              </Box>
            </Box>
          </motion.div>
        )}

        {/* Bottom: recent appointments + quick links */}
        <motion.div variants={fadeUp}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>

            {/* Recent appointments */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant='overline' sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1.2, fontSize: '0.68rem' }}>
                  Recent Appointments
                </Typography>
                <Box component='a' href='appointments' sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  View all →
                </Box>
              </Box>

              <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2.5, overflow: 'hidden' }}>
                {recentAppts.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant='body2' sx={{ color: '#94a3b8' }}>No appointments yet</Typography>
                  </Box>
                ) : (
                  recentAppts.map((a, i) => {
                    const chip = STATUS_CHIP[a.status] ?? { bg: '#f1f5f9', color: '#475569', label: a.status }
                    const initials = getInitials(a.patientName)
                    return (
                      <Box
                        key={a.id}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 2,
                          px: 2.5, py: 1.75,
                          borderBottom: i < recentAppts.length - 1 ? '1px solid #f8fafc' : 'none',
                          transition: 'background 0.12s',
                          '&:hover': { bgcolor: '#fafafa' },
                        }}
                      >
                        <Box sx={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: 0.2 }}>
                            {initials}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant='body2' fontWeight={600} color='#0f172a' noWrap>{a.patientName}</Typography>
                          <Typography variant='caption' sx={{ color: '#94a3b8' }} noWrap>
                            {a.serviceName} · {a.dateFormatted}
                          </Typography>
                        </Box>
                        <Chip
                          label={chip.label}
                          size='small'
                          sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.68rem', flexShrink: 0 }}
                        />
                      </Box>
                    )
                  })
                )}
              </Box>
            </Box>

            {/* Quick links */}
            <Box>
              <Typography variant='overline' sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1.2, fontSize: '0.68rem', display: 'block', mb: 1.5 }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  { label: 'Appointments', desc: 'View & manage all',   href: 'appointments' },
                  { label: 'Patients',     desc: 'Patient directory',   href: 'patients' },
                  { label: 'Billing',      desc: 'Payments & invoices', href: 'billing' },
                  { label: 'My Profile',   desc: 'Account settings',    href: 'profile' },
                ].map((link) => (
                  <Box
                    key={link.href}
                    component='a'
                    href={link.href}
                    sx={{
                      display: 'block', textDecoration: 'none',
                      bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2.5, p: 2,
                      transition: 'border-color 0.18s, box-shadow 0.18s',
                      '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
                    }}
                  >
                    <Typography variant='body2' fontWeight={600} color='#0f172a'>{link.label}</Typography>
                    <Typography variant='caption' sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>{link.desc}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

          </Box>
        </motion.div>

      </motion.div>
    </Box>
  )
}
