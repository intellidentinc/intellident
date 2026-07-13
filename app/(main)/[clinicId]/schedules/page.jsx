import SchedulesPage from '@/app/modules/schedules-page/SchedulesPage'
import { prisma } from '@/lib/prisma'
import { getPatientAppointments } from '@/lib/appointments'
import { getActivePatientContext } from '@/lib/patient-context'

export const metadata = { title: 'My Schedules | IntelliDent' }

// Server-fetch the patient's upcoming appointments so the list paints on first
// load — no post-hydration round-trip. The [clinicId] layout already guarded the
// session/clinic; we only need the patientId here.
export default async function Page() {
  const patient = await getActivePatientContext()

  let initialRows = []
  let clinicContact = null
  if (patient) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: patient.clinicId },
      select: { phone: true, landline: true, email: true },
    })
    clinicContact = clinic
    initialRows = await getPatientAppointments(patient.patientId, 'upcoming')
  }

  return <SchedulesPage initialRows={initialRows} initialTab='upcoming' clinicContact={clinicContact} />
}
