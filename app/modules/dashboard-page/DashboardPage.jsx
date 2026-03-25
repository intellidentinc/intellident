import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { prisma } from '@/lib/prisma'
import { CalendarDays, CheckCircle, Clock, XCircle } from 'lucide-react'

// ─── Patient dashboard ────────────────────────────────────────────────────────

async function PatientDashboard({ session }) {
  const patient = await prisma.patient.findUnique({
    where: { userId: session.userId },
  })

  const now = new Date()

  const [nextAppt, stats] = await Promise.all([
    patient
      ? prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            clinicId: patient.clinicId,
            isDeleted: false,
            status: { in: ['PENDING', 'CONFIRMED'] },
            scheduledAt: { gte: now },
          },
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
  const upcoming  = (countByStatus.PENDING  ?? 0) + (countByStatus.CONFIRMED ?? 0)
  const completed = countByStatus.COMPLETED ?? 0
  const cancelled = countByStatus.CANCELLED ?? 0

  const STATUS_CHIP = {
    PENDING:   { bg: '#fef9c3', color: '#854d0e', label: 'Pending confirmation' },
    CONFIRMED: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Greeting */}
      <Box>
        <Typography variant='h5' fontWeight={700} color='text.primary'>
          Welcome back, {session.firstName}!
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
          Here's a summary of your dental appointments.
        </Typography>
      </Box>

      {/* Next appointment */}
      {nextAppt ? (
        <Box
          sx={{
            bgcolor: '#fff',
            border: '1px solid',
            borderColor: '#bfdbfe',
            borderRadius: 3,
            p: 3,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CalendarDays size={22} color='#2563eb' />
            </Box>
            <Box>
              <Typography variant='caption' color='text.secondary' fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Next Appointment
              </Typography>
              <Typography variant='subtitle1' fontWeight={700} color='text.primary'>
                {nextAppt.service.name}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {new Date(nextAppt.scheduledAt).toLocaleString('en-PH', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit', hour12: true,
                })}
              </Typography>
              {nextAppt.dentist && (
                <Typography variant='body2' color='text.secondary'>
                  Dr. {nextAppt.dentist.user.firstName} {nextAppt.dentist.user.lastName}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
            {STATUS_CHIP[nextAppt.status] && (
              <Chip
                label={STATUS_CHIP[nextAppt.status].label}
                size='small'
                sx={{ bgcolor: STATUS_CHIP[nextAppt.status].bg, color: STATUS_CHIP[nextAppt.status].color, fontWeight: 600, fontSize: '0.72rem' }}
              />
            )}
            <Typography variant='caption' sx={{ color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>
              <a href='schedules' style={{ color: 'inherit', textDecoration: 'none' }}>View all schedules →</a>
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            bgcolor: '#f8fafc',
            border: '1.5px dashed',
            borderColor: '#cbd5e1',
            borderRadius: 3,
            p: 3,
            textAlign: 'center',
          }}
        >
          <CalendarDays size={32} color='#94a3b8' style={{ margin: '0 auto 8px' }} />
          <Typography variant='body1' fontWeight={600} color='text.secondary'>
            No upcoming appointments
          </Typography>
          <Typography variant='body2' color='text.disabled' sx={{ mt: 0.5 }}>
            Book your next dental visit to get started.
          </Typography>
          <Box
            component='a'
            href='schedules'
            sx={{
              display: 'inline-block',
              mt: 2,
              px: 3,
              py: 1,
              bgcolor: '#2563eb',
              color: '#fff',
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              '&:hover': { bgcolor: '#1d4ed8' },
            }}
          >
            Book Appointment
          </Box>
        </Box>
      )}

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
        <StatCard icon={<Clock size={20} color='#854d0e' />} bg='#fef9c3' label='Upcoming' value={upcoming} />
        <StatCard icon={<CheckCircle size={20} color='#15803d' />} bg='#dcfce7' label='Completed' value={completed} />
        <StatCard icon={<XCircle size={20} color='#b91c1c' />} bg='#fee2e2' label='Cancelled' value={cancelled} sx={{ gridColumn: { xs: 'span 2', sm: 'span 1' } }} />
      </Box>

      {/* CTA */}
      {nextAppt && (
        <Box
          sx={{
            bgcolor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 3,
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant='body1' fontWeight={600} color='#1e40af'>
              Need another appointment?
            </Typography>
            <Typography variant='body2' color='#3b82f6'>
              Browse available slots and request a new booking.
            </Typography>
          </Box>
          <Box
            component='a'
            href='schedules'
            sx={{
              px: 3,
              py: 1,
              bgcolor: '#2563eb',
              color: '#fff',
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: '#1d4ed8' },
            }}
          >
            Book Appointment
          </Box>
        </Box>
      )}
    </Box>
  )
}

function StatCard({ icon, bg, label, value, sx }) {
  return (
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
        ...sx,
      }}
    >
      <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box>
        <Typography variant='h6' fontWeight={700} color='text.primary' sx={{ lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {label}
        </Typography>
      </Box>
    </Box>
  )
}

// ─── Generic dashboard (ADMIN, RECEPTIONIST, DENTIST) ─────────────────────────

function GenericDashboard({ session, role }) {
  const roleDescriptions = {
    ADMIN:        'Manage clinic settings, users, services, and billing from the sidebar.',
    RECEPTIONIST: 'Create and manage appointments, patients, and reminders from the sidebar.',
    DENTIST:      'View your schedule and patient records from the sidebar.',
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant='h5' fontWeight={700} color='text.primary'>
          Welcome back, {session.firstName}!
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
          {roleDescriptions[role] ?? 'Use the sidebar to navigate.'}
        </Typography>
      </Box>

      <Box
        sx={{
          bgcolor: '#fff',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          p: 3,
        }}
      >
        <Typography variant='body2' color='text.secondary'>
          Role-specific dashboard content is coming soon. Use the navigation on the left to get started.
        </Typography>
      </Box>
    </Box>
  )
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export default async function DashboardPage({ session }) {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  })

  const role = user?.role ?? 'PATIENT'

  return (
    <SidebarInset>
      <header className='flex h-14 items-center gap-3 border-b bg-white px-4'>
        <SidebarTrigger />
        <div className='h-5 w-px bg-gray-200' />
        <span className='font-semibold text-slate-700'>Dashboard</span>
      </header>

      {role === 'PATIENT' ? (
        <PatientDashboard session={session} />
      ) : (
        <GenericDashboard session={session} role={role} />
      )}
    </SidebarInset>
  )
}
