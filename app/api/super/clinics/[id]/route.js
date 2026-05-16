import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { parseJsonBody, str } from '@/lib/validate'

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
  if (!user || user.role !== ROLES.SUPERADMIN) return null
  return session
}

export async function PATCH(request, { params }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const name    = str(parsed.body.name, 200)
  const { address } = parsed.body
  const phone   = str(parsed.body.phone, 20)

  if (!name) return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 })
  if (phone && !/^\+639\d{9}$/.test(phone)) {
    return NextResponse.json(
      { error: 'Phone must be in +63XXXXXXXXXX format (starts with +639)' },
      { status: 400 }
    )
  }

  const existing = await prisma.clinic.findUnique({ where: { id, isDeleted: false }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  const clinic = await prisma.clinic.update({
    where: { id },
    data: {
      name,
      address: address && typeof address === 'object' ? JSON.stringify(address) : null,
      phone: phone || null,
    },
    select: { id: true, name: true, code: true, address: true, logoUrl: true, email: true, phone: true },
  })

  return NextResponse.json(clinic)
}

export async function DELETE(request, { params }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const existing = await prisma.clinic.findUnique({ where: { id, isDeleted: false }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  await prisma.clinic.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
