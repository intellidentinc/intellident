import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAdminForClinic(clinicId) {
  const session = await getSession()
  if (!session) return null

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })

  if (!caller || caller.role !== 'ADMIN' || caller.clinicId !== clinicId) return null
  return caller
}

export async function GET(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinic = await prisma.clinic.findUnique({
    where: { id },
    select: { name: true, address: true, email: true, phone: true, landline: true, logoUrl: true }
  })

  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(clinic)
}

export async function PATCH(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, address, email, phone, landline } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 })
  if (!address?.trim()) return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  if (phone?.trim()) {
    const phoneRegex = /^\+639\d{9}$/
    if (!phoneRegex.test(phone.trim())) {
      return NextResponse.json({ error: 'Mobile must be in +63XXXXXXXXXX format (11 digits after +63)' }, { status: 400 })
    }
  }

  const clinic = await prisma.clinic.update({
    where: { id },
    data: {
      name: name.trim(),
      address: address.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      landline: landline?.trim() || null
    },
    select: { name: true, address: true, email: true, phone: true, landline: true, logoUrl: true }
  })

  return NextResponse.json(clinic)
}
