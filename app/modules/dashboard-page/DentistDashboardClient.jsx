'use client'

import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'

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
  PENDING:   { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  CONFIRMED: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
}

function StatCard({ label, value, href }) {
  const count = useCounter(value)
  const inner = (
    <Box sx={{
      bgcolor: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 2.5,
      p: 2.5,
      height: '100%',
      transition: 'border-color 0.18s, box-shadow 0.18s',
      '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
    }}>
      <Typography variant='h4' fontWeight={800} sx={{ lineHeight: 1, letterSpacing: -0.5, mb: 0.5, color: '#0f172a' }}>
        {count}
      </Typography>
      <Typography variant='body2' sx={{ color: '#64748b' }}>{label}</Typography>
    </Box>
  )
  if (href) return <Box component='a' href={href} sx={{ textDecoration: 'none', display: 'block', height: '100%' }}>{inner}</Box>
  return inner
}

const QUICK_LINKS = [
  { label: 'My Schedule',     desc: 'Day and week calendar',  href: 'schedule' },
  { label: 'Patient Records', desc: 'Browse your patients',   href: 'records' },
]

export default function DentistDashboardClient({ session, todayAppts, weekAppts, totalPatients, nextAppt }) {
  const [greeting, setGreeting] = useState('Hello')
  const [timeUntil, setTimeUntil] = useState(null)

  useEffect(() => {
    setGreeting(getGreeting())
    if (nextAppt?.scheduledAtRaw) setTimeUntil(getTimeUntil(nextAppt.scheduledAtRaw))
  }, [nextAppt])

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <motion.div variants={stagger} initial='hidden' animate='visible'>

        {/* Hero */}
        <motion.div variants={fadeUp}>
          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight={700} color='#0f172a' sx={{ letterSpacing: -0.3 }}>
              {greeting}, Dr. {session.lastName ?? session.firstName}
            </Typography>
            <Typography variant='body2' sx={{ color: '#94a3b8', mt: 0.5 }}>
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
            <StatCard label="Today's appointments" value={todayAppts}    href='schedule' />
            <StatCard label='Upcoming this week'   value={weekAppts}     href='schedule' />
            <Box sx={{ gridColumn: { xs: 'span 2', sm: 'span 1' } }}>
              <StatCard label='My patients'        value={totalPatients} href='records' />
            </Box>
          </Box>
        </motion.div>

        {/* Bottom: next patient + quick links side by side */}
        <motion.div variants={fadeUp}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>

            {/* Next patient */}
            <Box>
              <Typography variant='overline' sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1.2, fontSize: '0.68rem', display: 'block', mb: 1.5 }}>
                Next Patient
              </Typography>
              {nextAppt ? (
                <Box sx={{
                  bgcolor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 2.5,
                  p: 3,
                  transition: 'border-color 0.18s',
                  '&:hover': { borderColor: '#cbd5e1' },
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
                    <Box>
                      <Typography variant='h6' fontWeight={700} color='#0f172a' sx={{ lineHeight: 1.3 }}>
                        {nextAppt.patientName}
                      </Typography>
                      <Typography variant='body2' sx={{ color: '#64748b', mt: 0.75 }}>{nextAppt.serviceName}</Typography>
                      <Typography variant='body2' sx={{ color: '#64748b' }}>{nextAppt.scheduledAtFormatted}</Typography>
                    </Box>
                    {timeUntil && (
                      <Typography variant='caption' sx={{ fontWeight: 600, color: '#2563eb', bgcolor: '#eff6ff', px: 1.25, py: 0.25, borderRadius: 1, fontSize: '0.72rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {timeUntil}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2, borderTop: '1px solid #f8fafc' }}>
                    {STATUS_CHIP[nextAppt.status] && (
                      <Chip
                        label={STATUS_CHIP[nextAppt.status].label}
                        size='small'
                        sx={{ bgcolor: STATUS_CHIP[nextAppt.status].bg, color: STATUS_CHIP[nextAppt.status].color, fontWeight: 600, fontSize: '0.7rem' }}
                      />
                    )}
                    <Box component='a' href='schedule' sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      View full schedule →
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ border: '1px dashed #e2e8f0', borderRadius: 2.5, p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                  <CalendarDays size={26} color='#cbd5e1' style={{ margin: '0 auto 10px' }} />
                  <Typography variant='body2' fontWeight={600} sx={{ color: '#64748b' }}>No upcoming appointments</Typography>
                  <Typography variant='body2' sx={{ color: '#94a3b8', mt: 0.25 }}>Your schedule is clear.</Typography>
                </Box>
              )}
            </Box>

            {/* Quick links */}
            <Box>
              <Typography variant='overline' sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1.2, fontSize: '0.68rem', display: 'block', mb: 1.5 }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {QUICK_LINKS.map((link) => (
                  <Box
                    key={link.href}
                    component='a'
                    href={link.href}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      textDecoration: 'none', bgcolor: '#fff',
                      border: '1px solid #e2e8f0', borderRadius: 2.5, p: 2.5,
                      transition: 'border-color 0.18s, box-shadow 0.18s',
                      '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
                    }}
                  >
                    <Box>
                      <Typography variant='body2' fontWeight={600} color='#0f172a'>{link.label}</Typography>
                      <Typography variant='caption' sx={{ color: '#94a3b8' }}>{link.desc}</Typography>
                    </Box>
                    <Typography sx={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1 }}>→</Typography>
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
