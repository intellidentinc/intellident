import { NextResponse } from 'next/server'
import { getSession, setSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeAddress } from '@/lib/utils'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true, email: true, phone: true, address: true, dateOfBirth: true, isDeleted: true }
  })

  if (!user || user.isDeleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    address: user.address,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : ''
  })
}

export async function PATCH(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { firstName, lastName, email, phone, address, dateOfBirth } = await request.json()

  if (!firstName?.trim()) return NextResponse.json({ error: 'First name is required' }, { status: 400 })
  if (!lastName?.trim()) return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }
  if (phone?.trim() && !/^\+63\d{10}$/.test(phone.trim())) {
    return NextResponse.json({ error: 'Mobile must be +63XXXXXXXXXX (10 digits after +63)' }, { status: 400 })
  }

  const existing = await prisma.user.findFirst({
    where: { email: email.trim(), NOT: { id: session.userId } }
  })
  if (existing) return NextResponse.json({ error: 'Email is already in use' }, { status: 409 })

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(), // email simple change for now
      phone: phone?.trim() || null,
      address: normalizeAddress(address),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null
    },
    select: { firstName: true, lastName: true, email: true }
  })

  // Refresh session with updated name/email
  await setSession(session.userId, updated.email, updated.firstName, updated.lastName, session.clinicId)

  return NextResponse.json(updated)
}
