import { NextResponse } from 'next/server'
import { getSession, setSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseJsonBody, str, sanitizeEmail } from '@/lib/validate'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, middleInitial: true, lastName: true, email: true, phone: true, address: true, dateOfBirth: true, gender: true, isDeleted: true }
  })

  if (!user || user.isDeleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let parsedAddress = null
  if (user.address) {
    try { parsedAddress = JSON.parse(user.address) } catch { parsedAddress = user.address }
  }

  return NextResponse.json({
    firstName: user.firstName,
    middleInitial: user.middleInitial,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    address: parsedAddress,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : '',
    gender: user.gender ?? ''
  })
}

export async function PATCH(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const firstName     = str(parsed.body.firstName, 100)
  const middleInitial = str(parsed.body.middleInitial, 100)
  const lastName      = str(parsed.body.lastName, 100)
  const email         = sanitizeEmail(parsed.body.email)
  const phone         = str(parsed.body.phone, 20)
  const { address, dateOfBirth, gender } = parsed.body

  if (!firstName) return NextResponse.json({ error: 'First name is required' }, { status: 400 })
  if (!lastName) return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'Email is required or has an invalid format' }, { status: 400 })
  if (phone && !/^\+63\d{10}$/.test(phone)) {
    return NextResponse.json({ error: 'Mobile must be +63XXXXXXXXXX (10 digits after +63)' }, { status: 400 })
  }

  const existing = await prisma.user.findFirst({
    where: { email, NOT: { id: session.userId } }
  })
  if (existing) return NextResponse.json({ error: 'Email is already in use' }, { status: 409 })

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: {
      firstName,
      middleInitial: middleInitial || null,
      lastName,
      email,
      phone: phone || null,
      address: address && typeof address === 'object' ? JSON.stringify(address) : null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: gender || null
    },
    select: { firstName: true, lastName: true, email: true }
  })

  // Refresh session with updated name/email
  await setSession(session.userId, updated.email, updated.firstName, updated.lastName, session.clinicId, session.rememberMe, session.superAdmin)

  return NextResponse.json(updated)
}
