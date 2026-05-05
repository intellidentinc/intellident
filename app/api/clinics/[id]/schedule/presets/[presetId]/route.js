import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES, isAdmin } from '@/lib/roles'

async function getAdminForClinic(clinicId) {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })
  if (!caller || !isAdmin(caller.role)) return null
  const effectiveClinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
  if (effectiveClinicId !== clinicId) return null
  return caller
}

export async function DELETE(request, { params }) {
  const { id, presetId } = await params
  const caller = await getAdminForClinic(id)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const preset = await prisma.schedulePreset.findFirst({
    where: { id: presetId, clinicId: id, isDeleted: false }
  })
  if (!preset) return NextResponse.json({ error: 'Preset not found' }, { status: 404 })

  await prisma.schedulePreset.update({
    where: { id: presetId },
    data: { isDeleted: true, deletedAt: new Date() }
  })

  return NextResponse.json({ success: true })
}
