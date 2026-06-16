import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { getSession, isStepUpValid, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { sendRestoreOtpEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/rateLimit'
import { getRequestMeta, logAudit } from '@/lib/audit'

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const user = await getAuthContext()
  if (!user || user.role !== ROLES.SUPERADMIN) return null
  return { session, user }
}

export async function POST(request, { params }) {
  const auth = await requireSuperAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { session, user } = auth

  if (!isStepUpValid(session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const { ip, userAgent } = getRequestMeta(request)

  const { allowed } = await checkRateLimit(`${ip}:restore-otp`, 5, 15 * 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { id: clinicId } = await params

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId, isDeleted: false },
    select: { id: true, name: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  // Invalidate any existing unused restore OTPs for this superadmin
  await prisma.mfaOtp.updateMany({
    where: { userId: session.userId, usedAt: null },
    data: { usedAt: new Date() },
  })

  const otp = String(crypto.randomInt(100000, 1000000))
  const pendingToken = crypto.randomBytes(32).toString('hex')
  const codeHash = await bcrypt.hash(otp, 8)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.mfaOtp.create({
    data: { userId: session.userId, pendingToken, codeHash, expiresAt },
  })

  sendRestoreOtpEmail({
    to: user.email,
    firstName: user.firstName,
    code: otp,
    clinicName: clinic.name,
  }).catch(() => {})

  logAudit({
    userId: session.userId,
    clinicId,
    action: 'VERIFY',
    entity: 'RestoreOtp',
    entityId: clinicId,
    ipAddress: ip,
    userAgent,
    metadata: { step: 'otp_issued' },
  })

  return NextResponse.json({ pendingToken, expiresIn: 600 })
}
