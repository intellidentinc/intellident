import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getSession, grantStepUp, isStepUpValid } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseJsonBody, secret } from '@/lib/validate';
import { getRequestMeta, logAudit } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ valid: false }, { status: 401 });
  return NextResponse.json({ valid: isStepUpValid(session) });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody(request);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const password = secret(parsed.body.password, 128);
  if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { password: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { ip, userAgent } = getRequestMeta(request);
  const valid = await bcrypt.compare(password, user.password);

  logAudit({
    userId: session.userId,
    clinicId: session.clinicId,
    action: 'VERIFY',
    entity: 'StepUp',
    ipAddress: ip,
    userAgent,
    metadata: { success: valid },
  });

  if (!valid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  await grantStepUp();
  return NextResponse.json({ ok: true });
}
