import SchedulesPage from '@/app/modules/schedules-page/SchedulesPage'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPatientAppointments } from '@/lib/appointments'
import { ROLES } from '@/lib/roles'

export const metadata = { title: 'My Schedules | IntelliDent' }

// Server-fetch the patient's upcoming appointments so the list paints on first
// load — no post-hydration round-trip. The [clinicId] layout already guarded the
// session/clinic; we only need the patientId here.
export default async function Page() {
  const session = await getSession()

  let initialRows = []
  if (session) {
    const patient = await prisma.patient.findUnique({
      where: { userId: session.userId },
      select: { id: true, user: { select: { role: true } } },
    })
    if (patient && patient.user?.role === ROLES.PATIENT) {
      initialRows = await getPatientAppointments(patient.id, 'upcoming')
    }
  }

  return <SchedulesPage initialRows={initialRows} initialTab='upcoming' />
}
