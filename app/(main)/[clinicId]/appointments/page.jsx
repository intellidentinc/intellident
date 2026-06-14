import dayjs from 'dayjs'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppointmentsPage from '@/app/modules/appointments-page/AppointmentsPage'

export const metadata = { title: 'Appointments | IntelliDent' }

// Server-render the initial payload (default Week view + filter options) so the
// page paints with data on first load instead of mounting empty and firing a
// client-side fetch waterfall. Subsequent navigation/filtering still fetches
// client-side via the existing API routes.
export default async function Page({ params }) {
  const { clinicId: routeClinicId } = await params
  const session = await getSession()
  const clinicId = session?.clinicId ?? routeClinicId

  const now = dayjs()
  const from = now.startOf('week').toDate()
  const to = now.endOf('week').toDate()

  const [calendar, dentists, services] = await Promise.all([
    prisma.appointment.findMany({
      where: { clinicId, isDeleted: false, scheduledAt: { gte: from, lte: to } },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        dentist: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        service: { select: { id: true, name: true, duration: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.dentist.findMany({
      where: { clinicId, isDeleted: false },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { user: { firstName: 'asc' } },
    }),
    prisma.service.findMany({
      where: { clinicId, isDeleted: false },
      select: { id: true, name: true, duration: true, bufferTime: true, price: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Serialize Dates to ISO strings so the props match the shape the client
  // already receives from fetch().json().
  return (
    <AppointmentsPage
      initialCalendar={JSON.parse(JSON.stringify(calendar))}
      initialDentists={JSON.parse(JSON.stringify(dentists))}
      initialServices={JSON.parse(JSON.stringify(services))}
    />
  )
}
