import { SidebarInset } from '@/components/ui/sidebar'
import PageHeader from '@/components/commons/PageHeader'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import PatientDashboardClient from './PatientDashboardClient'
import ReceptionistDashboardClient from './ReceptionistDashboardClient'
import AdminDashboardClient from './AdminDashboardClient'
import DentistDashboardClient from './DentistDashboardClient'

const FMT_FULL = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }
const FMT_SHORT = { month: 'short', day: 'numeric', year: 'numeric' }

// ─── Patient ──────────────────────────────────────────────────────────────────

async function PatientDashboard({ session }) {
  const patient = await prisma.patient.findUnique({ where: { userId: session.userId } })
  const now = new Date()

  const [nextApptRaw, stats] = await Promise.all([
    patient
      ? prisma.appointment.findFirst({
          where: { patientId: patient.id, clinicId: patient.clinicId, isDeleted: false, status: { in: ['PENDING', 'CONFIRMED'] }, scheduledAt: { gte: now } },
          include: {
            service: { select: { name: true } },
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

  const nextAppt = nextApptRaw ? {
    serviceName: nextApptRaw.service.name,
    dentistName: nextApptRaw.dentist ? `${nextApptRaw.dentist.user.firstName} ${nextApptRaw.dentist.user.lastName}` : null,
    scheduledAtFormatted: new Date(nextApptRaw.scheduledAt).toLocaleString('en-PH', FMT_FULL),
    scheduledAtRaw: nextApptRaw.scheduledAt.toISOString(),
    status: nextApptRaw.status,
  } : null

  return (
    <PatientDashboardClient
      session={session}
      nextAppt={nextAppt}
      upcoming={(countByStatus.PENDING ?? 0) + (countByStatus.CONFIRMED ?? 0)}
      completed={countByStatus.COMPLETED ?? 0}
      cancelled={countByStatus.CANCELLED ?? 0}
    />
  )
}

// ─── Receptionist ─────────────────────────────────────────────────────────────

async function ReceptionistDashboard({ session }) {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, clinicId: true } })
  const clinicId = user?.role === ROLES.SUPERADMIN ? session.clinicId : user?.clinicId
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

  const serialized = recentAppts.map((a) => ({
    id: a.id,
    patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—',
    serviceName: a.service?.name ?? '—',
    dateFormatted: new Date(a.scheduledAt).toLocaleDateString('en-PH', FMT_SHORT),
    status: a.status,
  }))

  return (
    <ReceptionistDashboardClient
      session={session}
      pending={pending}
      todayTotal={todayTotal}
      todayConfirmed={todayConfirmed}
      totalPatients={totalPatients}
      recentAppts={serialized}
    />
  )
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function AdminDashboard({ session }) {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, clinicId: true } })
  const clinicId = user?.role === ROLES.SUPERADMIN ? session.clinicId : user?.clinicId
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

  const serialized = recentAppts.map((a) => ({
    id: a.id,
    patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—',
    serviceName: a.service?.name ?? '—',
    dateFormatted: new Date(a.scheduledAt).toLocaleDateString('en-PH', FMT_SHORT),
    status: a.status,
  }))

  return (
    <AdminDashboardClient
      session={session}
      totalUsers={totalUsers}
      totalServices={totalServices}
      totalPatients={totalPatients}
      apptThisMonth={apptThisMonth}
      pending={pending}
      recentAppts={serialized}
      monthName={now.toLocaleString('en-PH', { month: 'long' })}
    />
  )
}

// ─── Dentist ──────────────────────────────────────────────────────────────────

async function DentistDashboard({ session }) {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { clinicId: true } })
  const dentist = await prisma.dentist.findUnique({ where: { userId: session.userId }, select: { id: true } })
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const weekEnd    = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)

  const [todayAppts, weekAppts, totalPatients, nextApptRaw] = await Promise.all([
    dentist ? prisma.appointment.count({
      where: { dentistId: dentist.id, clinicId: user?.clinicId, isDeleted: false, status: { in: ['CONFIRMED', 'PENDING'] }, scheduledAt: { gte: todayStart, lt: todayEnd } },
    }) : 0,
    dentist ? prisma.appointment.count({
      where: { dentistId: dentist.id, clinicId: user?.clinicId, isDeleted: false, status: { in: ['CONFIRMED', 'PENDING'] }, scheduledAt: { gte: now, lt: weekEnd } },
    }) : 0,
    dentist ? prisma.patient.count({
      where: { clinicId: user?.clinicId, appointments: { some: { dentistId: dentist.id, isDeleted: false, status: { in: ['CONFIRMED', 'COMPLETED'] } } } },
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

  const nextAppt = nextApptRaw ? {
    patientName: nextApptRaw.patient ? `${nextApptRaw.patient.firstName} ${nextApptRaw.patient.lastName}` : '—',
    serviceName: nextApptRaw.service?.name ?? '—',
    scheduledAtFormatted: new Date(nextApptRaw.scheduledAt).toLocaleString('en-PH', FMT_FULL),
    scheduledAtRaw: nextApptRaw.scheduledAt.toISOString(),
    status: nextApptRaw.status,
  } : null

  return (
    <DentistDashboardClient
      session={session}
      todayAppts={todayAppts}
      weekAppts={weekAppts}
      totalPatients={totalPatients}
      nextAppt={nextAppt}
    />
  )
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export default async function DashboardPage({ session }) {
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  const role = user?.role ?? 'PATIENT'

  const content = role === ROLES.PATIENT                                    ? <PatientDashboard session={session} />
                : role === ROLES.RECEPTIONIST                              ? <ReceptionistDashboard session={session} />
                : (role === ROLES.ADMIN || role === ROLES.SUPERADMIN)      ? <AdminDashboard session={session} />
                : role === ROLES.DENTIST                                   ? <DentistDashboard session={session} />
                : null

  return (
    <SidebarInset>
      <PageHeader title='Dashboard' />
      {content}
    </SidebarInset>
  )
}
