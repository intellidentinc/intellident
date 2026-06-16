import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { getSession, isStepUpValid, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { parseJsonBody, str } from '@/lib/validate'
import { logAudit, getRequestMeta } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rateLimit'

const MAX_OTP_ATTEMPTS = 5

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const user = await getAuthContext()
  if (!user || user.role !== ROLES.SUPERADMIN) return null
  return session
}

export async function POST(request, { params }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!isStepUpValid(session)) {
    return NextResponse.json({ error: 'Step-up authentication required', requiresStepUp: true }, { status: 403 })
  }

  const { ip, userAgent } = getRequestMeta(request)

  const { allowed } = await checkRateLimit(`${ip}:restore-confirm`, 10, 15 * 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const { pendingToken, code, reason, snapshotDescription } = parsed.body
  const sanitizedReason = str(reason, 500)
  const sanitizedSnapshot = str(snapshotDescription, 200)

  if (!pendingToken || typeof pendingToken !== 'string') {
    return NextResponse.json({ error: 'pendingToken is required' }, { status: 400 })
  }
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'OTP code is required' }, { status: 400 })
  }
  if (!sanitizedReason) {
    return NextResponse.json({ error: 'Restore reason is required' }, { status: 400 })
  }

  const { id: clinicId } = await params

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId, isDeleted: false },
    select: { id: true, name: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  const mfa = await prisma.mfaOtp.findUnique({ where: { pendingToken } })

  if (!mfa || mfa.userId !== session.userId) {
    return NextResponse.json({ error: 'Invalid or expired restore session' }, { status: 400 })
  }
  if (mfa.usedAt) {
    return NextResponse.json({ error: 'This code has already been used' }, { status: 400 })
  }
  if (mfa.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Code has expired. Request a new one.' }, { status: 400 })
  }
  if (mfa.attempts >= MAX_OTP_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 })
  }

  const isValid = await bcrypt.compare(String(code).trim(), mfa.codeHash)

  if (!isValid) {
    const newAttempts = mfa.attempts + 1
    await prisma.mfaOtp.update({ where: { id: mfa.id }, data: { attempts: newAttempts } })
    const remaining = MAX_OTP_ATTEMPTS - newAttempts
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 })
    }
    return NextResponse.json(
      { error: `Incorrect code. ${remaining} attempt(s) remaining.` },
      { status: 401 }
    )
  }

  await prisma.mfaOtp.update({ where: { id: mfa.id }, data: { usedAt: new Date() } })

  // Confirmation token the operator retains as proof of authorization
  const confirmationToken = crypto.randomBytes(16).toString('hex').toUpperCase()

  logAudit({
    userId: session.userId,
    clinicId,
    action: 'RESTORE',
    entity: 'Clinic',
    entityId: clinicId,
    ipAddress: ip,
    userAgent,
    metadata: {
      reason: sanitizedReason,
      snapshotDescription: sanitizedSnapshot || null,
      confirmationToken,
      authorizedAt: new Date().toISOString(),
    },
  })

  return NextResponse.json({
    ok: true,
    confirmationToken,
    authorizedAt: new Date().toISOString(),
    clinicId,
    clinicName: clinic.name,
    message:
      'Restore authorization recorded. Proceed with the Neon point-in-time restore using this confirmation token as your audit reference.',
  })
}
