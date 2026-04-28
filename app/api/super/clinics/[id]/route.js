import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { normalizeAddress } from '@/lib/utils'

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
  const body = await request.json()
  const { name, address, phone } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 })

  if (phone?.trim()) {
    const phoneRegex = /^\+639\d{9}$/
    if (!phoneRegex.test(phone.trim())) {
      return NextResponse.json(
        { error: 'Phone must be in +63XXXXXXXXXX format (starts with +639)' },
        { status: 400 }
      )
    }
  }

  const existing = await prisma.clinic.findUnique({ where: { id, isDeleted: false }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  const clinic = await prisma.clinic.update({
    where: { id },
    data: {
      name: name.trim(),
      address: normalizeAddress(address),
      phone: phone?.trim() || null,
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
