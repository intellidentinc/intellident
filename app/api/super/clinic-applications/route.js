import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  if (!user || user.role !== ROLES.SUPERADMIN) return null
  return session
}

export async function GET(request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED']
  const status = validStatuses.includes(statusParam) ? statusParam : null

  const applications = await prisma.clinicApplication.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    include: { clinic: { select: { name: true } } },
  })

  return NextResponse.json(applications)
}
