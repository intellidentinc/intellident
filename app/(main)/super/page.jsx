import SuperPage from '@/app/modules/super-page/SuperPage'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Super Admin | IntelliDent' }

export default async function Page() {
  const clinics = await prisma.clinic.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, code: true, address: true, logoUrl: true, email: true, phone: true, isEnabled: true },
    orderBy: { name: 'asc' },
  })

  return <SuperPage clinics={clinics} />
}
