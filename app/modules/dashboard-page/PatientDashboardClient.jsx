'use client'

import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { CalendarDays, CheckCircle, Clock, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

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
  PENDING:   { bg: '#fef9c3', color: '#854d0e', label: 'Pending confirmation' },
  CONFIRMED: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
}

function StatCard({ icon, label, value }) {
  const count = useCounter(value)
  return (
    <motion.div variants={fadeUp} style={{ height: '100%' }}>
      <Box sx={{
        bgcolor: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 2.5,
        p: 2.5,
        height: '100%',
        transition: 'border-color 0.18s, box-shadow 0.18s',
        '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
      }}>
        <Box sx={{ color: '#94a3b8', mb: 1.5 }}>{icon}</Box>
        <Typography variant='h4' fontWeight={800} color='#0f172a' sx={{ lineHeight: 1, letterSpacing: -0.5, mb: 0.5 }}>
          {count}
        </Typography>
        <Typography variant='body2' sx={{ color: '#64748b' }}>{label}</Typography>
      </Box>
    </motion.div>
  )
}

export default function PatientDashboardClient({ session, nextAppt, upcoming, completed, cancelled }) {
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
              {greeting}, {session.firstName}
            </Typography>
            <Typography variant='body2' sx={{ color: '#94a3b8', mt: 0.5 }}>
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>
        </motion.div>

        {/* Next appointment */}
        <motion.div variants={fadeUp}>
          <Box sx={{ mb: 3 }}>
            {nextAppt ? (
              <Box sx={{
                bgcolor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 2.5,
                p: 3,
                transition: 'border-color 0.18s',
                '&:hover': { borderColor: '#cbd5e1' },
              }}>
                {/* Card header row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Typography variant='overline' sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1.2, fontSize: '0.68rem' }}>
                    Next Appointment
                  </Typography>
                  {timeUntil && (
                    <Typography variant='caption' sx={{ fontWeight: 600, color: '#2563eb', bgcolor: '#eff6ff', px: 1.25, py: 0.25, borderRadius: 1, fontSize: '0.72rem' }}>
                      {timeUntil}
                    </Typography>
                  )}
                </Box>

                {/* Content */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant='h6' fontWeight={700} color='#0f172a' sx={{ lineHeight: 1.3 }}>
                      {nextAppt.serviceName}
                    </Typography>
                    <Typography variant='body2' sx={{ color: '#64748b', mt: 0.75 }}>{nextAppt.scheduledAtFormatted}</Typography>
                    {nextAppt.dentistName && (
                      <Typography variant='body2' sx={{ color: '#64748b' }}>Dr. {nextAppt.dentistName}</Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
                    {STATUS_CHIP[nextAppt.status] && (
                      <Chip
                        label={STATUS_CHIP[nextAppt.status].label}
                        size='small'
                        sx={{ bgcolor: STATUS_CHIP[nextAppt.status].bg, color: STATUS_CHIP[nextAppt.status].color, fontWeight: 600, fontSize: '0.7rem' }}
                      />
                    )}
                    <Box component='a' href='schedules' sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      View all →
                    </Box>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box sx={{
                border: '1px dashed #e2e8f0',
                borderRadius: 2.5,
                p: { xs: 3, sm: 4 },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                textAlign: 'center',
              }}>
                <CalendarDays size={28} color='#cbd5e1' />
                <Box>
                  <Typography variant='body2' fontWeight={600} sx={{ color: '#64748b' }}>No upcoming appointments</Typography>
                  <Typography variant='body2' sx={{ color: '#94a3b8', mt: 0.25 }}>Book your next dental visit to get started.</Typography>
                </Box>
                <Box component='a' href='schedules?book=1' sx={{
                  mt: 0.5, px: 3, py: 1, bgcolor: '#2563eb', color: '#fff',
                  borderRadius: 2, fontWeight: 600, fontSize: '0.8rem',
                  textDecoration: 'none', transition: 'background 0.15s',
                  '&:hover': { bgcolor: '#1d4ed8' },
                }}>
                  Book Appointment
                </Box>
              </Box>
            )}
          </Box>
        </motion.div>

        {/* Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          <StatCard icon={<Clock size={18} />} label='Upcoming' value={upcoming} />
          <StatCard icon={<CheckCircle size={18} />} label='Completed' value={completed} />
          <Box sx={{ gridColumn: { xs: 'span 2', sm: 'span 1' } }}>
            <StatCard icon={<XCircle size={18} />} label='Cancelled' value={cancelled} />
          </Box>
        </Box>

        {/* Book more */}
        {nextAppt && (
          <motion.div variants={fadeUp}>
            <Box sx={{
              bgcolor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 2.5,
              px: 3,
              py: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}>
              <Typography variant='body2' sx={{ color: '#64748b' }}>Need to schedule another visit?</Typography>
              <Box component='a' href='schedules?book=1' sx={{
                px: 2.5, py: 0.875, bgcolor: '#2563eb', color: '#fff',
                borderRadius: 1.5, fontWeight: 600, fontSize: '0.8rem',
                textDecoration: 'none', transition: 'background 0.15s',
                '&:hover': { bgcolor: '#1d4ed8' },
              }}>
                Book Appointment
              </Box>
            </Box>
          </motion.div>
        )}

      </motion.div>
    </Box>
  )
}
