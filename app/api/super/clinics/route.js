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

function generateCode(name) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 5) || 'CLN'
  )
}

export async function POST(request) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  const code = generateCode(name)

  const clinic = await prisma.clinic.create({
    data: {
      name: name.trim(),
      address: normalizeAddress(address),
      phone: phone?.trim() || null,
      code,
    },
    select: { id: true, name: true, code: true, address: true, logoUrl: true, email: true, phone: true },
  })

  return NextResponse.json(clinic, { status: 201 })
}
