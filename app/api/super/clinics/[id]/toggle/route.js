import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'

async function requireSuperAdmin(request) {
  const session = await getSession()
  if (!session) return null
  const user = await getAuthContext()
  if (!user || user.role !== ROLES.SUPERADMIN) return null
  return session
}

export async function POST(request, { params }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const existing = await prisma.clinic.findUnique({ where: { id, isDeleted: false }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  // Atomic toggle — avoids read-then-write race condition
  await prisma.$executeRaw`UPDATE clinics SET "isEnabled" = NOT "isEnabled" WHERE id = ${id}`
  revalidateTag('clinic-enabled');

  const updated = await prisma.clinic.findUnique({
    where: { id },
    select: { id: true, name: true, code: true, address: true, logoUrl: true, email: true, phone: true, isEnabled: true },
  })

  const { ip, userAgent } = getRequestMeta(request)
  logAudit({
    userId: session.userId,
    clinicId: id,
    action: 'UPDATE',
    entity: 'Clinic',
    entityId: id,
    ipAddress: ip,
    userAgent,
    metadata: { isEnabled: updated.isEnabled },
  })

  return NextResponse.json(updated)
}
