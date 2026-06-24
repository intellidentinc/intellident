import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { getSession, isStepUpValid, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { str } from '@/lib/validate'
import { logAudit, getRequestMeta } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rateLimit'
import { importClinicBackup } from '@/lib/restore'

const MAX_OTP_ATTEMPTS = 5
const MAX_BACKUP_BYTES = 25 * 1024 * 1024 // 25 MB

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

  let form
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const pendingToken = form.get('pendingToken')
  const code = form.get('code')
  const sanitizedReason = str(form.get('reason'), 500)
  const sanitizedSnapshot = str(form.get('snapshotDescription'), 200)
  const file = form.get('file')

  if (!pendingToken || typeof pendingToken !== 'string') {
    return NextResponse.json({ error: 'pendingToken is required' }, { status: 400 })
  }
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'OTP code is required' }, { status: 400 })
  }
  if (!sanitizedReason) {
    return NextResponse.json({ error: 'Restore reason is required' }, { status: 400 })
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Backup file is required' }, { status: 400 })
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: 'Backup file is too large (max 25 MB)' }, { status: 413 })
  }

  const { id: clinicId } = await params

  // Parse + validate the backup file BEFORE consuming the OTP, so a bad file
  // doesn't waste the one-time code.
  let backup
  try {
    backup = JSON.parse(await file.text())
  } catch {
    return NextResponse.json({ error: 'Backup file is not valid JSON' }, { status: 400 })
  }
  if (!backup || typeof backup !== 'object' || !backup._meta) {
    return NextResponse.json({ error: 'Backup file is missing metadata' }, { status: 400 })
  }
  if (backup._meta.clinicId !== clinicId) {
    return NextResponse.json({ error: 'This backup belongs to a different clinic' }, { status: 400 })
  }

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
  const authorizedAt = new Date().toISOString()

  // Perform the actual restore — idempotent upserts, all-or-nothing.
  let summary
  try {
    summary = await prisma.$transaction(
      (tx) => importClinicBackup(tx, clinicId, backup),
      { timeout: 120_000 }
    )
  } catch (err) {
    console.error('Restore import failed:', err)
    return NextResponse.json(
      { error: err?.message || 'Restore failed while importing the backup.' },
      { status: 400 }
    )
  }

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
      authorizedAt,
      schemaVersion: backup._meta.schemaVersion ?? null,
      summary,
    },
  })

  return NextResponse.json({
    ok: true,
    confirmationToken,
    authorizedAt,
    clinicId,
    clinicName: clinic.name,
    summary,
    message: 'Restore completed. Data has been recovered from the backup file.',
  })
}
