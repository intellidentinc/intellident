import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { prisma } from '@/lib/prisma'
import {
  CalendarDays, CheckCircle, Clock, XCircle,
  Users, Stethoscope, UserCog, CalendarCheck,
  AlertCircle,
} from 'lucide-react'

// ─── Shared helpers ────────────────────────────────────────────────────────────

function StatCard({ icon, bg, label, value, href, sx }) {
  const inner = (
    <Box
      sx={{
        bgcolor: '#fff',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        transition: 'box-shadow 0.15s',
        ...(href ? { cursor: 'pointer', '&:hover': { boxShadow: '0 2px 8px rgba(37,99,235,0.10)', borderColor: '#bfdbfe' } } : {}),
        ...sx,
      }}
    >
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box>
        <Typography variant='h6' fontWeight={700} color='text.primary' sx={{ lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography variant='caption' color='text.secondary'>{label}</Typography>
      </Box>
    </Box>
  )
  if (href) return <Box component='a' href={href} sx={{ textDecoration: 'none' }}>{inner}</Box>
  return inner
}

function SectionTitle({ children }) {
  return (
    <Typography variant='overline' color='text.disabled' fontWeight={700} sx={{ letterSpacing: 0.8 }}>
      {children}
    </Typography>
  )
}

// ─── Patient dashboard ────────────────────────────────────────────────────────

async function PatientDashboard({ session }) {
  const patient = await prisma.patient.findUnique({ where: { userId: session.userId } })
  const now = new Date()

  const [nextAppt, stats] = await Promise.all([
    patient
      ? prisma.appointment.findFirst({
          where: { patientId: patient.id, clinicId: patient.clinicId, isDeleted: false, status: { in: ['PENDING', 'CONFIRMED'] }, scheduledAt: { gte: now } },
          include: {
            service: { select: { name: true, duration: true } },
            dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { scheduledAt: 'asc' },
        })
      : null,
    patient
      ? prisma.appointment.groupBy({
          by: ['status'],
          where: { patientId: patient.id, clinicId: patient.clinicId, isDeleted: false },
          _count: { id: true },
        })
      : [],
  ])

  const countByStatus = {}
  stats.forEach((s) => { countByStatus[s.status] = s._count.id })
  const upcoming  = (countByStatus.PENDING ?? 0) + (countByStatus.CONFIRMED ?? 0)
  const completed = countByStatus.COMPLETED ?? 0
  const cancelled = countByStatus.CANCELLED ?? 0

  const STATUS_CHIP = {
    PENDING:   { bg: '#fef9c3', color: '#854d0e', label: 'Pending confirmation' },
    CONFIRMED: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant='h5' fontWeight={700} color='text.primary'>Welcome back, {session.firstName}!</Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>Here's a summary of your dental appointments.</Typography>
      </Box>

      {nextAppt ? (
        <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: '#bfdbfe', borderRadius: 3, p: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CalendarDays size={22} color='#2563eb' />
            </Box>
            <Box>
              <Typography variant='caption' color='text.secondary' fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Next Appointment</Typography>
              <Typography variant='subtitle1' fontWeight={700} color='text.primary'>{nextAppt.service.name}</Typography>
              <Typography variant='body2' color='text.secondary'>
                {new Date(nextAppt.scheduledAt).toLocaleString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
              </Typography>
              {nextAppt.dentist && <Typography variant='body2' color='text.secondary'>Dr. {nextAppt.dentist.user.firstName} {nextAppt.dentist.user.lastName}</Typography>}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
            {STATUS_CHIP[nextAppt.status] && (
              <Chip label={STATUS_CHIP[nextAppt.status].label} size='small' sx={{ bgcolor: STATUS_CHIP[nextAppt.status].bg, color: STATUS_CHIP[nextAppt.status].color, fontWeight: 600, fontSize: '0.72rem' }} />
            )}
            <Typography variant='caption' sx={{ color: '#2563eb', fontWeight: 600 }}>
              <a href='schedules' style={{ color: 'inherit', textDecoration: 'none' }}>View all schedules →</a>
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ bgcolor: '#f8fafc', border: '1.5px dashed', borderColor: '#cbd5e1', borderRadius: 3, p: 3, textAlign: 'center' }}>
          <CalendarDays size={32} color='#94a3b8' style={{ margin: '0 auto 8px' }} />
          <Typography variant='body1' fontWeight={600} color='text.secondary'>No upcoming appointments</Typography>
          <Typography variant='body2' color='text.disabled' sx={{ mt: 0.5 }}>Book your next dental visit to get started.</Typography>
          <Box component='a' href='schedules' sx={{ display: 'inline-block', mt: 2, px: 3, py: 1, bgcolor: '#2563eb', color: '#fff', borderRadius: 2, fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', '&:hover': { bgcolor: '#1d4ed8' } }}>
            Book Appointment
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
        <StatCard icon={<Clock size={20} color='#854d0e' />} bg='#fef9c3' label='Upcoming' value={upcoming} />
        <StatCard icon={<CheckCircle size={20} color='#15803d' />} bg='#dcfce7' label='Completed' value={completed} />
        <StatCard icon={<XCircle size={20} color='#b91c1c' />} bg='#fee2e2' label='Cancelled' value={cancelled} sx={{ gridColumn: { xs: 'span 2', sm: 'span 1' } }} />
      </Box>

      {nextAppt && (
        <Box sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 3, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography variant='body1' fontWeight={600} color='#1e40af'>Need another appointment?</Typography>
            <Typography variant='body2' color='#3b82f6'>Browse available slots and request a new booking.</Typography>
          </Box>
          <Box component='a' href='schedules' sx={{ px: 3, py: 1, bgcolor: '#2563eb', color: '#fff', borderRadius: 2, fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#1d4ed8' } }}>
            Book Appointment
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ─── Receptionist dashboard ───────────────────────────────────────────────────

async function ReceptionistDashboard({ session }) {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { clinicId: true } })
  const clinicId = user?.clinicId
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const [pending, todayTotal, todayConfirmed, totalPatients, recentAppts] = await Promise.all([
    prisma.appointment.count({ where: { clinicId, isDeleted: false, status: 'PENDING' } }),
    prisma.appointment.count({ where: { clinicId, isDeleted: false, scheduledAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.appointment.count({ where: { clinicId, isDeleted: false, status: 'CONFIRMED', scheduledAt: { gte: now } } }),
    prisma.patient.count({ where: { clinicId, isDeleted: false } }),
    prisma.appointment.findMany({
      where: { clinicId, isDeleted: false },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const STATUS_CHIP = {
    PENDING:   { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
    CONFIRMED: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
    COMPLETED: { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
    CANCELLED: { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
    NO_SHOW:   { bg: '#f1f5f9', color: '#475569', label: 'No-show' },
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant='h5' fontWeight={700} color='text.primary'>Good day, {session.firstName}!</Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>Here's today's clinic overview.</Typography>
      </Box>

      {/* Stat cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
        <StatCard icon={<AlertCircle size={20} color='#854d0e' />} bg='#fef9c3' label='Pending bookings' value={pending} href='appointments' />
        <StatCard icon={<CalendarDays size={20} color='#1d4ed8' />} bg='#dbeafe' label="Today's appointments" value={todayTotal} href='appointments' />
        <StatCard icon={<CalendarCheck size={20} color='#15803d' />} bg='#dcfce7' label='Confirmed upcoming' value={todayConfirmed} href='appointments' />
        <StatCard icon={<Users size={20} color='#7c3aed' />} bg='#ede9fe' label='Total patients' value={totalPatients} href='patients' />
      </Box>

      {/* Pending CTA */}
      {pending > 0 && (
        <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #d97706', borderRadius: 3, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <AlertCircle size={20} color='#d97706' />
            <Box>
              <Typography variant='body1' fontWeight={600} color='#92400e'>{pending} booking request{pending > 1 ? 's' : ''} need your attention</Typography>
              <Typography variant='body2' color='#b45309'>Review and confirm or cancel pending appointments.</Typography>
            </Box>
          </Box>
          <Box component='a' href='appointments' sx={{ px: 3, py: 1, bgcolor: '#d97706', color: '#fff', borderRadius: 2, fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#b45309' } }}>
            Review Now
          </Box>
        </Box>
      )}

      {/* Recent appointments */}
      <Box>
        <SectionTitle>Recent Appointments</SectionTitle>
        <Box sx={{ mt: 1, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
          {recentAppts.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant='body2' color='text.disabled'>No appointments yet</Typography>
            </Box>
          ) : (
            recentAppts.map((a, i) => {
              const chip = STATUS_CHIP[a.status] ?? { bg: '#f1f5f9', color: '#475569', label: a.status }
              return (
                <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5, borderBottom: i < recentAppts.length - 1 ? '1px solid' : 'none', borderColor: 'divider', '&:hover': { bgcolor: '#f8fafc' } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='body2' fontWeight={600} color='text.primary' noWrap>
                      {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—'}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {a.service?.name ?? '—'} · {new Date(a.scheduledAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </Box>
                  <Chip label={chip.label} size='small' sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.7rem', flexShrink: 0 }} />
                </Box>
              )
            })
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ─── Admin dashboard ──────────────────────────────────────────────────────────

async function AdminDashboard({ session }) {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { clinicId: true } })
  const clinicId = user?.clinicId
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalUsers, totalServices, totalPatients, apptThisMonth, pending, recentAppts] = await Promise.all([
    prisma.user.count({ where: { clinicId, isDeleted: false } }),
    prisma.service.count({ where: { clinicId, isDeleted: false } }),
    prisma.patient.count({ where: { clinicId, isDeleted: false } }),
    prisma.appointment.count({ where: { clinicId, isDeleted: false, scheduledAt: { gte: monthStart } } }),
    prisma.appointment.count({ where: { clinicId, isDeleted: false, status: 'PENDING' } }),
    prisma.appointment.findMany({
      where: { clinicId, isDeleted: false },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const STATUS_CHIP = {
    PENDING:   { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
    CONFIRMED: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
    COMPLETED: { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
    CANCELLED: { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
    NO_SHOW:   { bg: '#f1f5f9', color: '#475569', label: 'No-show' },
  }

  const monthName = now.toLocaleString('en-PH', { month: 'long' })

  return (
    <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant='h5' fontWeight={700} color='text.primary'>Welcome, {session.firstName}!</Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>Clinic-wide overview for this month.</Typography>
      </Box>

      {/* Stat cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <StatCard icon={<UserCog size={20} color='#1d4ed8' />} bg='#dbeafe' label='Total users' value={totalUsers} href='users' />
        <StatCard icon={<Users size={20} color='#7c3aed' />} bg='#ede9fe' label='Total patients' value={totalPatients} href='appointments' />
        <StatCard icon={<Stethoscope size={20} color='#0f766e' />} bg='#ccfbf1' label='Services offered' value={totalServices} href='services' />
        <StatCard icon={<CalendarDays size={20} color='#15803d' />} bg='#dcfce7' label={`Appointments in ${monthName}`} value={apptThisMonth} href='appointments' />
        <StatCard icon={<AlertCircle size={20} color='#854d0e' />} bg='#fef9c3' label='Pending bookings' value={pending} href='appointments' sx={{ gridColumn: { xs: 'span 2', sm: 'span 2' } }} />
      </Box>

      {/* Pending CTA */}
      {pending > 0 && (
        <Box sx={{ bgcolor: '#fffbeb', border: '1px solid #d97706', borderRadius: 3, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <AlertCircle size={20} color='#d97706' />
            <Box>
              <Typography variant='body1' fontWeight={600} color='#92400e'>{pending} booking request{pending > 1 ? 's' : ''} awaiting confirmation</Typography>
              <Typography variant='body2' color='#b45309'>These were submitted by patients and need to be reviewed.</Typography>
            </Box>
          </Box>
          <Box component='a' href='appointments' sx={{ px: 3, py: 1, bgcolor: '#d97706', color: '#fff', borderRadius: 2, fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#b45309' } }}>
            Review Now
          </Box>
        </Box>
      )}

      {/* Recent */}
      <Box>
        <SectionTitle>Recent Appointments</SectionTitle>
        <Box sx={{ mt: 1, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
          {recentAppts.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}><Typography variant='body2' color='text.disabled'>No appointments yet</Typography></Box>
          ) : (
            recentAppts.map((a, i) => {
              const chip = STATUS_CHIP[a.status] ?? { bg: '#f1f5f9', color: '#475569', label: a.status }
              return (
                <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5, borderBottom: i < recentAppts.length - 1 ? '1px solid' : 'none', borderColor: 'divider', '&:hover': { bgcolor: '#f8fafc' } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='body2' fontWeight={600} color='text.primary' noWrap>
                      {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—'}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {a.service?.name ?? '—'} · {new Date(a.scheduledAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </Box>
                  <Chip label={chip.label} size='small' sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: '0.7rem', flexShrink: 0 }} />
                </Box>
              )
            })
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ─── Dentist dashboard ────────────────────────────────────────────────────────

async function DentistDashboard({ session }) {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { clinicId: true } })
  const dentist = await prisma.dentist.findUnique({ where: { userId: session.userId }, select: { id: true } })
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const weekEnd    = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)

  const [todayAppts, weekAppts, totalPatients, nextAppt] = await Promise.all([
    dentist ? prisma.appointment.count({
      where: { dentistId: dentist.id, clinicId: user?.clinicId, isDeleted: false, status: { in: ['CONFIRMED', 'PENDING'] }, scheduledAt: { gte: todayStart, lt: todayEnd } },
    }) : 0,
    dentist ? prisma.appointment.count({
      where: { dentistId: dentist.id, clinicId: user?.clinicId, isDeleted: false, status: { in: ['CONFIRMED', 'PENDING'] }, scheduledAt: { gte: now, lt: weekEnd } },
    }) : 0,
    dentist ? prisma.patient.count({
      where: {
        clinicId: user?.clinicId,
        appointments: { some: { dentistId: dentist.id, isDeleted: false, status: { in: ['CONFIRMED', 'COMPLETED'] } } },
      },
    }) : 0,
    dentist ? prisma.appointment.findFirst({
      where: { dentistId: dentist.id, clinicId: user?.clinicId, isDeleted: false, status: { in: ['CONFIRMED', 'PENDING'] }, scheduledAt: { gte: now } },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    }) : null,
  ])

  const STATUS_CHIP = {
    PENDING:   { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
    CONFIRMED: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant='h5' fontWeight={700} color='text.primary'>Good day, Dr. {session.lastName ?? session.firstName}!</Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>Here's your schedule overview.</Typography>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <StatCard icon={<CalendarDays size={20} color='#1d4ed8' />} bg='#dbeafe' label="Today's appointments" value={todayAppts} href='schedule' />
        <StatCard icon={<CalendarCheck size={20} color='#15803d' />} bg='#dcfce7' label='Upcoming this week' value={weekAppts} href='schedule' />
        <StatCard icon={<Users size={20} color='#7c3aed' />} bg='#ede9fe' label='My patients' value={totalPatients} href='records' sx={{ gridColumn: { xs: 'span 2', sm: 'span 1' } }} />
      </Box>

      {/* Next appointment */}
      {nextAppt ? (
        <Box sx={{ bgcolor: '#fff', border: '1px solid #bfdbfe', borderRadius: 3, p: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CalendarDays size={22} color='#2563eb' />
            </Box>
            <Box>
              <Typography variant='caption' color='text.secondary' fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Next Appointment</Typography>
              <Typography variant='subtitle1' fontWeight={700} color='text.primary'>
                {nextAppt.patient ? `${nextAppt.patient.firstName} ${nextAppt.patient.lastName}` : '—'}
              </Typography>
              <Typography variant='body2' color='text.secondary'>{nextAppt.service?.name ?? '—'}</Typography>
              <Typography variant='body2' color='text.secondary'>
                {new Date(nextAppt.scheduledAt).toLocaleString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
            {STATUS_CHIP[nextAppt.status] && (
              <Chip label={STATUS_CHIP[nextAppt.status].label} size='small' sx={{ bgcolor: STATUS_CHIP[nextAppt.status].bg, color: STATUS_CHIP[nextAppt.status].color, fontWeight: 600, fontSize: '0.72rem' }} />
            )}
            <Typography variant='caption' sx={{ color: '#2563eb', fontWeight: 600 }}>
              <a href='schedule' style={{ color: 'inherit', textDecoration: 'none' }}>View full schedule →</a>
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ bgcolor: '#f8fafc', border: '1.5px dashed', borderColor: '#cbd5e1', borderRadius: 3, p: 3, textAlign: 'center' }}>
          <CalendarDays size={32} color='#94a3b8' style={{ margin: '0 auto 8px' }} />
          <Typography variant='body1' fontWeight={600} color='text.secondary'>No upcoming appointments</Typography>
          <Typography variant='body2' color='text.disabled' sx={{ mt: 0.5 }}>Your schedule is clear. Check back later.</Typography>
        </Box>
      )}

      {/* Quick links */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        {[
          { label: 'View My Schedule', desc: 'See your day and week calendar', href: 'schedule', color: '#2563eb', bg: '#eff6ff' },
          { label: 'Patient Records', desc: 'Browse patients assigned to you', href: 'records', color: '#7c3aed', bg: '#f5f3ff' },
        ].map((link) => (
          <Box key={link.href} component='a' href={link.href} sx={{ display: 'block', textDecoration: 'none', bgcolor: link.bg, border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } }}>
            <Typography variant='body1' fontWeight={700} sx={{ color: link.color }}>{link.label}</Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>{link.desc}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export default async function DashboardPage({ session }) {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  const role = user?.role ?? 'PATIENT'

  const content = role === 'PATIENT'       ? <PatientDashboard session={session} />
                : role === 'RECEPTIONIST'  ? <ReceptionistDashboard session={session} />
                : role === 'ADMIN'         ? <AdminDashboard session={session} />
                : role === 'DENTIST'       ? <DentistDashboard session={session} />
                : null

  return (
    <SidebarInset>
      <PageHeader title='Dashboard' />
      {content}
    </SidebarInset>
  )
}
