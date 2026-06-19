import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin, sanitizeExpiryRoles } from '@/lib/roles'
import { parseJsonBody, str, sanitizeEmail } from '@/lib/validate'
import { revalidateTag } from 'next/cache'

async function getAdminForClinic(clinicId) {
  const session = await getSession()
  if (!session) return null

  const caller = await getAuthContext()

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
    select: { name: true, address: true, email: true, phone: true, landline: true, logoUrl: true, reservationFeeAmount: true, reservationFeeDeductible: true, paymongoEnabled: true, passwordExpiryEnabled: true, passwordExpiryDays: true, passwordExpiryRoles: true, singleSessionEnabled: true, notifConfig: true, reminder1Hours: true, reminder2Hours: true, auditLogRetentionDays: true, patientRecordRetentionDays: true, billingRetentionDays: true }
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

  const FULL_SELECT = { name: true, address: true, email: true, phone: true, landline: true, logoUrl: true, reservationFeeAmount: true, reservationFeeDeductible: true, paymongoEnabled: true, passwordExpiryEnabled: true, passwordExpiryDays: true, passwordExpiryRoles: true, singleSessionEnabled: true, notifConfig: true, reminder1Hours: true, reminder2Hours: true, auditLogRetentionDays: true, patientRecordRetentionDays: true, billingRetentionDays: true }

  const hasPaymentFields = 'paymongoEnabled' in parsed.body || 'reservationFeeAmount' in parsed.body || 'reservationFeeDeductible' in parsed.body
  const hasSingleSession = 'singleSessionEnabled' in parsed.body
  const hasPasswordExpiry = 'passwordExpiryEnabled' in parsed.body
  const hasNotifConfig = 'notifConfig' in parsed.body || 'reminder1Hours' in parsed.body || 'reminder2Hours' in parsed.body
  const hasAuditRetention = 'auditLogRetentionDays' in parsed.body

  if (hasSingleSession) {
    const singleSessionEnabled = parsed.body.singleSessionEnabled === true
    const clinic = await prisma.clinic.update({ where: { id }, data: { singleSessionEnabled }, select: FULL_SELECT })
    return NextResponse.json(clinic)
  }

  if (hasPasswordExpiry) {
    const data = { passwordExpiryEnabled: parsed.body.passwordExpiryEnabled === true }

    if ('passwordExpiryDays' in parsed.body) {
      const days = parseInt(parsed.body.passwordExpiryDays, 10)
      if (isNaN(days) || days < 30 || days > 365) {
        return NextResponse.json({ error: 'Password expiry days must be between 30 and 365' }, { status: 400 })
      }
      data.passwordExpiryDays = days
    }

    if ('passwordExpiryRoles' in parsed.body) {
      const rolesResult = sanitizeExpiryRoles(parsed.body.passwordExpiryRoles)
      if (rolesResult.error) return NextResponse.json({ error: rolesResult.error }, { status: 400 })
      data.passwordExpiryRoles = rolesResult.roles
    }

    const clinic = await prisma.clinic.update({ where: { id }, data, select: FULL_SELECT })
    return NextResponse.json(clinic)
  }

  if (hasNotifConfig) {
    const r1 = parseInt(parsed.body.reminder1Hours, 10)
    const r2 = parseInt(parsed.body.reminder2Hours, 10)
    const data = {}
    if ('notifConfig' in parsed.body) {
      const nc = parsed.body.notifConfig
      if (nc !== null && (typeof nc !== 'object' || Array.isArray(nc))) {
        return NextResponse.json({ error: 'notifConfig must be an object or null' }, { status: 400 })
      }
      data.notifConfig = nc ?? null
    }
    if (!isNaN(r1) && r1 > 0) data.reminder1Hours = r1
    if (!isNaN(r2) && r2 > 0) data.reminder2Hours = r2
    const clinic = await prisma.clinic.update({ where: { id }, data, select: FULL_SELECT })
    return NextResponse.json(clinic)
  }

  if (hasAuditRetention) {
    const raw = parsed.body.auditLogRetentionDays
    const auditLogRetentionDays = raw === null ? null : (parseInt(raw, 10) > 0 ? parseInt(raw, 10) : null)
    const clinic = await prisma.clinic.update({ where: { id }, data: { auditLogRetentionDays }, select: FULL_SELECT })
    return NextResponse.json(clinic)
  }

  const hasDataRetention = 'patientRecordRetentionDays' in parsed.body || 'billingRetentionDays' in parsed.body
  if (hasDataRetention) {
    const data = {}
    if ('patientRecordRetentionDays' in parsed.body) {
      const raw = parsed.body.patientRecordRetentionDays
      data.patientRecordRetentionDays = raw === null ? null : (parseInt(raw, 10) > 0 ? parseInt(raw, 10) : null)
    }
    if ('billingRetentionDays' in parsed.body) {
      const raw = parsed.body.billingRetentionDays
      data.billingRetentionDays = raw === null ? null : (parseInt(raw, 10) > 0 ? parseInt(raw, 10) : null)
    }
    const clinic = await prisma.clinic.update({ where: { id }, data, select: FULL_SELECT })
    return NextResponse.json(clinic)
  }

  if (!hasPaymentFields) {
    if (!name) return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 })
    if (!address || typeof address !== 'object' || !address.cityMuni) return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'Email is required or has an invalid format' }, { status: 400 })
    if (phone && !/^\+639\d{9}$/.test(phone)) {
      return NextResponse.json({ error: 'Mobile must be in +63XXXXXXXXXX format (11 digits after +63)' }, { status: 400 })
    }
    const clinic = await prisma.clinic.update({
      where: { id },
      data: { name, address: address && typeof address === 'object' ? JSON.stringify(address) : null, email, phone: phone || null, landline: landline || null },
      select: FULL_SELECT
    })
    revalidateTag(`clinic-profile-${id}`) // refresh cached sidebar name/logo immediately
    return NextResponse.json(clinic)
  }

  // Payment settings update
  const data = {}
  if ('paymongoEnabled' in parsed.body) data.paymongoEnabled = parsed.body.paymongoEnabled === true
  if ('reservationFeeAmount' in parsed.body) {
    const rawFee = parseFloat(parsed.body.reservationFeeAmount)
    data.reservationFeeAmount = isNaN(rawFee) || rawFee < 0 ? 0 : rawFee
  }
  if ('reservationFeeDeductible' in parsed.body) data.reservationFeeDeductible = parsed.body.reservationFeeDeductible === true
  const clinic = await prisma.clinic.update({ where: { id }, data, select: FULL_SELECT })
  return NextResponse.json(clinic)
}
