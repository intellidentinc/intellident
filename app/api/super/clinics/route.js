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

  const code = generateCode(name)

  const clinic = await prisma.clinic.create({
    data: {
      name,
      address: address && typeof address === 'object' ? JSON.stringify(address) : null,
      phone: phone || null,
      code,
    },
    select: { id: true, name: true, code: true, address: true, logoUrl: true, email: true, phone: true },
  })

  return NextResponse.json(clinic, { status: 201 })
}
