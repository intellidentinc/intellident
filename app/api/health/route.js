import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await prisma.$queryRaw`SELECT 1`
  return NextResponse.json({ ok: true })
}
