import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { ROLES, isAdmin } from '@/lib/roles';
import { revalidateTag } from 'next/cache';

const LOGO_SIGNATURES = [
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  ext: 'png', magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
]

const COMPRESSED_SIGNATURES = [
  [0x50, 0x4B, 0x03, 0x04],              // ZIP
  [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], // RAR
  [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], // 7-Zip
  [0x1F, 0x8B],                           // GZIP
  [0x42, 0x5A, 0x68],                     // BZIP2
  [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00], // XZ
]

function detectLogoType(buf) {
  for (const sig of LOGO_SIGNATURES)
    if (sig.magic.every((b, i) => buf[i] === b)) return sig
  return null
}

function isCompressed(buf) {
  return COMPRESSED_SIGNATURES.some(sig => sig.every((b, i) => buf[i] === b))
}

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

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  if (isCompressed(buffer))
    return NextResponse.json({ error: 'Compressed files (.zip, .rar, .7z, etc.) are not allowed.' }, { status: 400 });

  const detected = detectLogoType(buffer);
  if (!detected)
    return NextResponse.json({ error: 'Only JPG and PNG files are allowed.' }, { status: 400 });

  const path = `${id}/${Date.now()}.${detected.ext}`;

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

  const { error: uploadError } = await supabase.storage
    .from('clinic-logos')
    .upload(path, buffer, { contentType: detected.mime, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from('clinic-logos').getPublicUrl(path);

  await prisma.clinic.update({
    where: { id },
    data: { logoUrl: publicUrl },
  });

  revalidateTag(`clinic-profile-${id}`); // refresh cached sidebar logo immediately

  return NextResponse.json({ logoUrl: publicUrl });
}
