import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await prisma.$queryRaw`SELECT 1`
  return NextResponse.json({ ok: true })
}
