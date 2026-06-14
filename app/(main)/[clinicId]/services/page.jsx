import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ServicesPage from '@/app/modules/services-page/ServicesPage'

export const metadata = { title: 'Services | IntelliDent' }

// Server-render the service catalog + dentist list so the table paints with data
// on first load instead of mounting empty and firing client-side fetches.
export default async function Page({ params }) {
  const { clinicId: routeClinicId } = await params
  const session = await getSession()
  const clinicId = session?.clinicId ?? routeClinicId

  const [services, dentists] = await Promise.all([
    prisma.service.findMany({
      where: { clinicId, isDeleted: false },
      include: {
        dentists: {
          where: { isDeleted: false },
          select: { id: true, user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dentist.findMany({
      where: { clinicId, isDeleted: false },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { user: { firstName: 'asc' } },
    }),
  ])

  return (
    <ServicesPage
      initialServices={JSON.parse(JSON.stringify(services))}
      initialDentists={JSON.parse(JSON.stringify(dentists))}
    />
  )
}
