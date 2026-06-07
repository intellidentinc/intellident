import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { SidebarProvider } from '@/components/ui/sidebar'
import SuperSidebar from '@/app/modules/super-page/SuperSidebar'

export default async function SuperLayout({ children }) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, firstName: true, lastName: true },
  })
  if (!user || user.role !== ROLES.SUPERADMIN) redirect('/sign-in')

  const enrichedSession = {
    ...session,
    firstName: user.firstName,
    lastName: user.lastName,
  }

  return (
    <SidebarProvider>
      <SuperSidebar session={enrichedSession} />
      {children}
    </SidebarProvider>
  )
}
