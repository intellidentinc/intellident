import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { getRequestMeta, logAudit } from '@/lib/audit'
import { parseJsonBody, str } from '@/lib/validate'
import { checkRateLimit } from '@/lib/rateLimit'

const VALID_TYPES = ['ACCESS', 'CORRECTION', 'DELETION', 'TRANSFER']
const VALID_STATUSES = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED']

export async function GET(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const own = searchParams.get('own') === 'true'

  // Patients can only see their own requests
  if (!isAdmin(caller.role) && !own) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  if (!clinicId) return NextResponse.json({ error: 'No clinic selected' }, { status: 400 })

  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)))
  const typeFilter = searchParams.get('type')
  const statusFilter = searchParams.get('status')

  const where = {
    ...(own ? { userId: session.userId } : { clinicId }),
    ...(typeFilter && VALID_TYPES.includes(typeFilter) ? { type: typeFilter } : {}),
    ...(statusFilter && VALID_STATUSES.includes(statusFilter) ? { status: statusFilter } : {}),
  }

  const [requests, total] = await Promise.all([
    prisma.dataRequest.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        description: true,
        adminNotes: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        transfer: {
          select: {
            id: true, status: true, sourceDentistId: true, destinationDentistId: true, destinationClinic: { select: { name: true } },
            items: { select: { id: true, sourceRecordId: true, sourceRecord: { select: { title: true } } } },
          },
        },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: page * pageSize,
      take: pageSize,
    }),
    prisma.dataRequest.count({ where }),
  ])

  return NextResponse.json({ requests, total, page, pageSize })
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await getAuthContext()
  if (!caller || caller.role !== ROLES.PATIENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ip } = getRequestMeta(request)
  const rateKey = `${ip ?? 'unknown'}:data-request`
  const rl = await checkRateLimit(rateKey, 5, 3600)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const { type } = parsed.body
  const description = str(parsed.body.description, 2000)

  if (!type || !VALID_TYPES.includes(type) || type === 'TRANSFER') {
    return NextResponse.json({ error: 'Invalid request type. Must be ACCESS, CORRECTION, or DELETION.' }, { status: 400 })
  }

  const dataRequest = await prisma.dataRequest.create({
    data: {
      userId: session.userId,
      clinicId: caller.clinicId,
      type,
      description: description || null,
    },
    select: { id: true, type: true, status: true, description: true, createdAt: true },
  })

  return NextResponse.json(dataRequest, { status: 201 })
}
