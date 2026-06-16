import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { parseJsonBody, str } from '@/lib/validate'
import {
  sendClinicApplicationApproved,
  sendClinicApplicationRejected,
} from '@/lib/email'

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const user = await getAuthContext()
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

export async function PATCH(request, { params }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const action = str(parsed.body.action, 10)
  const notes  = str(parsed.body.notes, 1000) ?? null

  if (action !== 'APPROVE' && action !== 'REJECT') {
    return NextResponse.json({ error: 'action must be APPROVE or REJECT' }, { status: 400 })
  }

  const application = await prisma.clinicApplication.findUnique({ where: { id } })
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  if (application.status !== 'PENDING') {
    return NextResponse.json({ error: 'Application has already been processed' }, { status: 409 })
  }

  if (action === 'APPROVE') {
    const code = generateCode(application.clinicName)

    const updated = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: application.clinicName,
          address: application.businessAddress,
          phone: application.businessPhone,
          email: application.businessEmail,
          code,
        },
      })
      return tx.clinicApplication.update({
        where: { id },
        data: { status: 'APPROVED', clinicId: clinic.id },
        include: { clinic: { select: { name: true } } },
      })
    })

    sendClinicApplicationApproved({
      clinicName: application.clinicName,
      applicantName: application.contactPersonName,
      email: application.businessEmail,
      signUpUrl: `${process.env.NEXT_PUBLIC_APP_URL}/sign-up`,
    }).catch(() => {})

    return NextResponse.json(updated)
  }

  // REJECT
  const updated = await prisma.clinicApplication.update({
    where: { id },
    data: { status: 'REJECTED', notes },
    include: { clinic: { select: { name: true } } },
  })

  sendClinicApplicationRejected({
    clinicName: application.clinicName,
    applicantName: application.contactPersonName,
    email: application.businessEmail,
    reason: notes,
  }).catch(() => {})

  return NextResponse.json(updated)
}
