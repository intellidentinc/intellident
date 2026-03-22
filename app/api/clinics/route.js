import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const clinics = await prisma.clinic.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(clinics);
  } catch (error) {
    console.error('Clinics fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
