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

export async function POST(request, { params }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const clinic = await prisma.clinic.findUnique({ where: { id, isDeleted: false }, select: { id: true, isEnabled: true } })
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  const updated = await prisma.clinic.update({
    where: { id },
    data: { isEnabled: !clinic.isEnabled },
    select: { id: true, name: true, code: true, address: true, logoUrl: true, email: true, phone: true, isEnabled: true },
  })

  return NextResponse.json(updated)
}
