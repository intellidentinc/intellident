import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export default async function SuperLayout({ children }) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  if (!user || user.role !== ROLES.SUPERADMIN) redirect('/sign-in')

  return <>{children}</>
}
