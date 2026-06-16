import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin, ROLES } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str } from '@/lib/validate'

const VALID_STATUSES = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED']
const TERMINAL_STATUSES = ['RESOLVED', 'REJECTED']

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  })
  if (!caller || !isAdmin(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  if (!clinicId) return NextResponse.json({ error: 'No clinic selected' }, { status: 400 })

  const { id } = await params
  const { ip, userAgent } = getRequestMeta(request)

  const existing = await prisma.dataRequest.findUnique({
    where: { id },
    select: { id: true, clinicId: true, status: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.clinicId !== clinicId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const { status } = parsed.body
  const adminNotes = str(parsed.body.adminNotes, 2000)

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const data = {}
  if (status !== undefined) data.status = status
  if (adminNotes !== undefined) data.adminNotes = adminNotes || null
  if (status && TERMINAL_STATUSES.includes(status) && !TERMINAL_STATUSES.includes(existing.status)) {
    data.resolvedAt = new Date()
  }

  const updated = await prisma.dataRequest.update({
    where: { id },
    data,
    select: {
      id: true, type: true, status: true, description: true,
      adminNotes: true, resolvedAt: true, updatedAt: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  logAudit({
    userId: session.userId,
    clinicId,
    action: 'UPDATE',
    entity: 'DataRequest',
    entityId: id,
    ipAddress: ip,
    userAgent,
    metadata: { status: data.status, adminNotes: data.adminNotes },
  })

  return NextResponse.json(updated)
}
