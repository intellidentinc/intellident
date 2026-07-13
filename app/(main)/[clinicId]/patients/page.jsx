import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import PatientsPage from '@/app/modules/patients-page/PatientsPage'

export const metadata = { title: 'Patients | IntelliDent' }

// Server-render the first page (default sort) so the table paints with data on
// first load instead of mounting empty and firing a client-side fetch.
export default async function Page({ params }) {
  const { clinicId: routeClinicId } = await params
  const session = await getSession()
  const clinicId = session?.clinicId ?? routeClinicId

  const where = { isDeleted: false, role: ROLES.PATIENT, patients: { some: { clinicId, isDeleted: false } } }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        createdAt: true,
        patients: { where: { clinicId, isDeleted: false }, select: { patientCode: true } },
      },
      orderBy: { firstName: 'asc' },
      skip: 0,
      take: 10,
    }),
    prisma.user.count({ where }),
  ])

  const rows = users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    email: u.email,
    createdAt: u.createdAt,
    patientCode: u.patients[0]?.patientCode ?? null,
  }))

  return <PatientsPage initialRows={JSON.parse(JSON.stringify(rows))} initialTotal={total} />
}
