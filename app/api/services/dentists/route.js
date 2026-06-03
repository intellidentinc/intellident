import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })
  if (!caller || !isAdmin(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId

  const dentists = await prisma.dentist.findMany({
    where: { clinicId, isDeleted: false },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { user: { firstName: 'asc' } }
  })

  const res = NextResponse.json({ dentists })
  res.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=3600')
  return res
}
