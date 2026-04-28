import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { ROLES, isAdmin } from '@/lib/roles';

async function getAdminForClinic(clinicId) {
  const session = await getSession();
  if (!session) return null;

  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, clinicId: true },
  });

  if (!caller || !isAdmin(caller.role)) return null;
  const effectiveClinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId;
  if (effectiveClinicId !== clinicId) return null;
  return caller;
}

export async function POST(request, { params }) {
  const { id } = await params;
  const caller = await getAdminForClinic(id);
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const allowedTypes = ['image/jpeg', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG and PNG files are allowed' }, { status: 400 });
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 });
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${id}/${Date.now()}.${ext}`;

  const clinic = await prisma.clinic.findUnique({
    where: { id },
    select: { logoUrl: true },
  });

  // Delete old logo if exists
  if (clinic?.logoUrl) {
    const url = new URL(clinic.logoUrl);
    const oldPath = url.pathname.split('/clinic-logos/')[1];
    if (oldPath) {
      await supabase.storage.from('clinic-logos').remove([oldPath]);
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('clinic-logos')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from('clinic-logos').getPublicUrl(path);

  await prisma.clinic.update({
    where: { id },
    data: { logoUrl: publicUrl },
  });

  return NextResponse.json({ logoUrl: publicUrl });
}
