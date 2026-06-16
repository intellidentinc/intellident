import { NextResponse } from 'next/server'
import { getSession, getAuthContext } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'

async function getAdminForClinic(clinicId) {
  const session = await getSession()
  if (!session) return null
  const caller = await getAuthContext()
  if (!caller || !isAdmin(caller.role)) return null
  const effectiveClinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  if (effectiveClinicId !== clinicId) return null
  return caller
}

export async function DELETE(request, { params }) {
  const { id, closureId } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const closure = await prisma.clinicClosure.findUnique({ where: { id: closureId } })
  if (!closure || closure.clinicId !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.clinicClosure.delete({ where: { id: closureId } })

  return NextResponse.json({ success: true })
}
