import { NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/auth';
import { getRequestMeta, logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

export async function POST(request) {
  const { ip, userAgent } = getRequestMeta(request);
  const session = await getSession();

  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { clinicId: true },
    });
    logAudit({ userId: session.userId, clinicId: user?.clinicId, action: 'LOGOUT', entity: 'User', entityId: session.userId, ipAddress: ip, userAgent });
  }

  await clearSession();
  return NextResponse.json({ message: 'Signed out successfully' });
}
