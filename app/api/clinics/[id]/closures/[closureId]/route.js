import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAdminForClinic(clinicId) {
  const session = await getSession()
  if (!session) return null
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true }
  })
  if (!caller || caller.role !== 'ADMIN' || caller.clinicId !== clinicId) return null
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
