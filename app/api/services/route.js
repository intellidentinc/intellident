import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str } from '@/lib/validate'

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

export async function GET() {
  const caller = await getAdminCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const services = await prisma.service.findMany({
    where: { clinicId: caller.clinicId, isDeleted: false },
    include: {
      dentists: {
        where: { isDeleted: false },
        include: { user: { select: { firstName: true, lastName: true } } }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ services })
}

export async function POST(request) {
  const caller = await getAdminCaller()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ip, userAgent } = getRequestMeta(request)
  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { duration, price, bufferTime, dentistIds } = parsed.body
  const name = str(parsed.body.name, 200)

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!duration || duration < 15 || duration > 240) {
    return NextResponse.json({ error: 'Duration must be between 15 and 240 minutes' }, { status: 400 })
  }
  if (bufferTime !== undefined && (bufferTime < 0 || bufferTime > 30)) {
    return NextResponse.json({ error: 'Buffer time must be between 0 and 30 minutes' }, { status: 400 })
  }

  const service = await prisma.service.create({
    data: {
      clinicId: caller.clinicId,
      name,
      duration: parseInt(duration, 10),
      price: price !== undefined && price !== null && price !== '' ? parseFloat(price) : null,
      bufferTime: bufferTime !== undefined ? parseInt(bufferTime, 10) : 0,
      dentists: dentistIds?.length
        ? { connect: dentistIds.map((id) => ({ id })) }
        : undefined
    },
    include: {
      dentists: {
        where: { isDeleted: false },
        include: { user: { select: { firstName: true, lastName: true } } }
      }
    }
  })

  logAudit({ userId: caller.id, clinicId: caller.clinicId, action: 'CREATE', entity: 'Service', entityId: service.id, ipAddress: ip, userAgent, metadata: { name: service.name } })

  return NextResponse.json({ service }, { status: 201 })
}
