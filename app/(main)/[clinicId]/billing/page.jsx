import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BillingPage from '@/app/modules/billing-page/BillingPage'

export const metadata = { title: 'Billing | IntelliDent' }

// Server-render the first page (default createdAt desc) so the table paints with
// data on first load instead of mounting empty and firing a client-side fetch.
export default async function Page({ params }) {
  const { clinicId: routeClinicId } = await params
  const session = await getSession()
  const clinicId = session?.clinicId ?? routeClinicId

  const where = { clinicId, isDeleted: false }
  const [billings, total] = await Promise.all([
    prisma.billing.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        appointment: {
          select: {
            appointmentCode: true,
            scheduledAt: true,
            dentistId: true,
            service: { select: { name: true, price: true } },
            dentist: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
          },
        },
        payments: { where: { isDeleted: false }, orderBy: { paidAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    }),
    prisma.billing.count({ where }),
  ])

  return <BillingPage initialRows={JSON.parse(JSON.stringify(billings))} initialTotal={total} />
}
