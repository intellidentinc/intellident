import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { parseJsonBody, str, sanitizeEmail } from '@/lib/validate'

async function getAdminForClinic(clinicId) {
  const session = await getSession()
  if (!session) return null

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })

  if (!caller || !isAdmin(caller.role)) return null
  const effectiveClinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  if (effectiveClinicId !== clinicId) return null
  return caller
}

export async function GET(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinic = await prisma.clinic.findUnique({
    where: { id },
    select: { name: true, address: true, email: true, phone: true, landline: true, logoUrl: true, reservationFeeAmount: true, paymongoEnabled: true, passwordExpiryEnabled: true }
  })

  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let parsedAddress = null
  if (clinic.address) {
    try { parsedAddress = JSON.parse(clinic.address) } catch { parsedAddress = clinic.address }
  }

  return NextResponse.json({ ...clinic, address: parsedAddress })
}

export async function PATCH(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const name     = str(parsed.body.name, 200)
  const { address } = parsed.body
  const email    = sanitizeEmail(parsed.body.email)
  const phone    = str(parsed.body.phone, 20)
  const landline = str(parsed.body.landline, 20)

  // Payment settings (optional fields — only updated when present)
  const hasPaymentFields = 'paymongoEnabled' in parsed.body || 'reservationFeeAmount' in parsed.body
  const hasPasswordExpiry = 'passwordExpiryEnabled' in parsed.body

  if (hasPasswordExpiry) {
    // Password expiry toggle update
    const passwordExpiryEnabled = parsed.body.passwordExpiryEnabled === true
    const clinic = await prisma.clinic.update({
      where: { id },
      data: { passwordExpiryEnabled },
      select: { name: true, address: true, email: true, phone: true, landline: true, logoUrl: true, reservationFeeAmount: true, paymongoEnabled: true, passwordExpiryEnabled: true }
    })
    return NextResponse.json(clinic)
  }

  if (!hasPaymentFields) {
    // Regular clinic profile update
    if (!name) return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 })
    if (!address || typeof address !== 'object' || !address.cityMuni) return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'Email is required or has an invalid format' }, { status: 400 })
    if (phone && !/^\+639\d{9}$/.test(phone)) {
      return NextResponse.json({ error: 'Mobile must be in +63XXXXXXXXXX format (11 digits after +63)' }, { status: 400 })
    }

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        name,
        address: address && typeof address === 'object' ? JSON.stringify(address) : null,
        email,
        phone: phone || null,
        landline: landline || null
      },
      select: { name: true, address: true, email: true, phone: true, landline: true, logoUrl: true, reservationFeeAmount: true, paymongoEnabled: true, passwordExpiryEnabled: true }
    })
    return NextResponse.json(clinic)
  }

  // Payment settings update
  const paymongoEnabled = parsed.body.paymongoEnabled === true
  const rawFee = parseFloat(parsed.body.reservationFeeAmount)
  const reservationFeeAmount = isNaN(rawFee) || rawFee < 0 ? 0 : rawFee

  const clinic = await prisma.clinic.update({
    where: { id },
    data: { paymongoEnabled, reservationFeeAmount },
    select: { name: true, address: true, email: true, phone: true, landline: true, logoUrl: true, reservationFeeAmount: true, paymongoEnabled: true, passwordExpiryEnabled: true }
  })

  return NextResponse.json(clinic)
}
