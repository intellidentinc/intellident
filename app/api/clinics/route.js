import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const clinics = await prisma.clinic.findMany({
      where: { isDeleted: false, isEnabled: true },
      select: {
        id: true,
        name: true,
        code: true,
        logoUrl: true,
        address: true,
        services: {
          where: { isDeleted: false },
          select: { name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = clinics.map((clinic) => {
      let city = null;
      if (clinic.address) {
        try {
          const parsed = JSON.parse(clinic.address);
          city = parsed?.cityMuni?.name ?? null;
        } catch {
          // Legacy/plain-string address (e.g. seed data) — use as-is
          city = clinic.address.trim() || null;
        }
      }
      return {
        id: clinic.id,
        name: clinic.name,
        code: clinic.code,
        logoUrl: clinic.logoUrl,
        city,
        services: clinic.services.map((s) => s.name),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Clinics fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
