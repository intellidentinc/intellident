import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'

async function getAdminCaller() {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })
  if (!caller || !isAdmin(caller.role)) return null
  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  return { ...caller, clinicId, id: session.userId }
}

export async function PATCH(request, { params }) {
  const caller = await getAdminCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const { id } = await params
  const { name, duration, price, bufferTime, dentistIds } = await request.json()

  const existing = await prisma.service.findUnique({
    where: { id },
    select: { clinicId: true, isDeleted: true }
  })
  if (!existing || existing.isDeleted || existing.clinicId !== caller.clinicId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!duration || duration < 15 || duration > 240) {
    return NextResponse.json({ error: 'Duration must be between 15 and 240 minutes' }, { status: 400 })
  }
  if (bufferTime !== undefined && (bufferTime < 0 || bufferTime > 30)) {
    return NextResponse.json({ error: 'Buffer time must be between 0 and 30 minutes' }, { status: 400 })
  }

  const service = await prisma.service.update({
    where: { id },
    data: {
      name: name.trim(),
      duration: parseInt(duration, 10),
      price: price !== undefined && price !== null && price !== '' ? parseFloat(price) : null,
      bufferTime: bufferTime !== undefined ? parseInt(bufferTime, 10) : 0,
      dentists: {
        set: dentistIds?.length ? dentistIds.map((did) => ({ id: did })) : []
      }
    },
    include: {
      dentists: {
        where: { isDeleted: false },
        include: { user: { select: { firstName: true, lastName: true } } }
      }
    }
  })

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'UPDATE', entity: 'Service', entityId: id, ipAddress: ip, userAgent, metadata: { name: service.name } })

  return NextResponse.json({ service })
}

export async function DELETE(request, { params }) {
  const caller = await getAdminCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const { id } = await params

  const existing = await prisma.service.findUnique({
    where: { id },
    select: { clinicId: true, isDeleted: true }
  })
  if (!existing || existing.isDeleted || existing.clinicId !== caller.clinicId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const svc = await prisma.service.findUnique({ where: { id }, select: { name: true } })
  await prisma.service.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() }
  })

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'DELETE', entity: 'Service', entityId: id, ipAddress: ip, userAgent, metadata: { name: svc?.name } })

  return NextResponse.json({ success: true })
}
