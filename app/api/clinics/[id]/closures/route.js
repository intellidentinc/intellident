import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'
import { parseJsonBody, str } from '@/lib/validate'

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

  const closures = await prisma.clinicClosure.findMany({
    where: { clinicId: id },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, reason: true }
  })

  return NextResponse.json(closures)
}

export async function POST(request, { params }) {
  const { id } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { date } = parsed.body
  const reason = str(parsed.body.reason, 200)

  if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })

  const parsedDate = new Date(date)
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const closure = await prisma.clinicClosure.create({
    data: { clinicId: id, date: parsedDate, reason: reason?.trim() || null },
    select: { id: true, date: true, reason: true }
  })

  return NextResponse.json(closure)
}
