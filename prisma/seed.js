const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ─── Helpers (mirrors lib/crypto.js using Node 18+ Web Crypto) ────────────────

const enc = new TextEncoder();

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

async function generateKeyMaterial(password) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const kek = await globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey']
  );

  const masterKey = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const wrapped = await globalThis.crypto.subtle.wrapKey('raw', masterKey, kek, 'AES-KW');

  return {
    wrappedKey: toBase64(wrapped),
    keySalt: toBase64(salt),
  };
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const clinics = [
  { name: 'Maria Laura Cruz Dental Clinic', address: 'Quezon City', code: 'MLC' },
  { name: 'KH Dental Aesthetics',           address: 'Makati City', code: 'KH'  },
  { name: 'Cabasal Dental Clinic',          address: 'Pasig City',  code: 'CAB' },
];

const PASSWORD = '12345678';

function usersForClinic(slug) {
  return [
    { firstName: 'Admin',        lastName: slug, email: `admin.${slug}@intellident.test`,        role: 'ADMIN' },
    { firstName: 'Receptionist', lastName: slug, email: `receptionist.${slug}@intellident.test`, role: 'RECEPTIONIST' },
    { firstName: 'Dentist',      lastName: slug, email: `dentist.${slug}@intellident.test`,      role: 'DENTIST' },
    { firstName: 'Patient',      lastName: slug, email: `patient.${slug}@intellident.test`,      role: 'PATIENT' },
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  // Upsert clinics
  const clinicRecords = [];
  for (const clinic of clinics) {
    let record = await prisma.clinic.findFirst({ where: { name: clinic.name } });
    if (!record) {
      record = await prisma.clinic.create({ data: clinic });
      console.log(`Clinic created: ${record.name}`);
    } else {
      record = await prisma.clinic.update({ where: { id: record.id }, data: { code: clinic.code } });
      console.log(`Clinic exists:  ${record.name} (code: ${record.code})`);
    }
    clinicRecords.push(record);
  }

  // Seed users per clinic
  for (const clinic of clinicRecords) {
    const slug = clinic.name.split(' ')[0].toLowerCase();
    const users = usersForClinic(slug);

    for (const u of users) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (existing) {
        // Backfill missing profile records for pre-existing seed users
        if (u.role === 'PATIENT') {
          const hasProfile = await prisma.patient.findUnique({ where: { userId: existing.id } });
          if (!hasProfile) {
            const year = new Date().getFullYear();
            const count = await prisma.patient.count({ where: { clinicId: clinic.id } });
            const patientCode = `PAT-${clinic.code ?? 'CLN'}-${year}-${String(count + 1).padStart(5, '0')}`;
            await prisma.patient.create({
              data: { userId: existing.id, clinicId: clinic.id, firstName: existing.firstName ?? u.firstName, lastName: existing.lastName ?? u.lastName, patientCode },
            });
            console.log(`  Backfilled Patient profile: ${u.email} (${patientCode})`);
          } else if (hasProfile && !hasProfile.patientCode) {
            // Backfill missing patientCode on existing profile
            const year = new Date().getFullYear();
            const count = await prisma.patient.count({ where: { clinicId: clinic.id, patientCode: { not: null } } });
            const patientCode = `PAT-${clinic.code ?? 'CLN'}-${year}-${String(count + 1).padStart(5, '0')}`;
            await prisma.patient.update({ where: { id: hasProfile.id }, data: { patientCode } });
            console.log(`  Backfilled patientCode: ${u.email} → ${patientCode}`);
          }
        } else if (u.role === 'DENTIST') {
          const hasProfile = await prisma.dentist.findUnique({ where: { userId: existing.id } });
          if (!hasProfile) {
            await prisma.dentist.create({ data: { userId: existing.id, clinicId: clinic.id } });
            console.log(`  Backfilled Dentist profile: ${u.email}`);
          }
        } else if (u.role === 'RECEPTIONIST') {
          const hasProfile = await prisma.receptionist.findUnique({ where: { userId: existing.id } });
          if (!hasProfile) {
            await prisma.receptionist.create({ data: { userId: existing.id, clinicId: clinic.id } });
            console.log(`  Backfilled Receptionist profile: ${u.email}`);
          }
        }
        console.log(`  Skip (exists): ${u.email}`);
        continue;
      }

      const { wrappedKey, keySalt } = await generateKeyMaterial(PASSWORD);

      const createdUser = await prisma.user.create({
        data: {
          email:      u.email,
          firstName:  u.firstName,
          lastName:   u.lastName,
          password:   hashedPassword,
          role:       u.role,
          clinicId:   clinic.id,
          wrappedKey,
          keySalt,
        },
      });

      // Create profile records for role-specific models
      if (u.role === 'PATIENT') {
        const year = new Date().getFullYear();
        const count = await prisma.patient.count({ where: { clinicId: clinic.id } });
        const patientCode = `PAT-${clinic.code ?? 'CLN'}-${year}-${String(count + 1).padStart(5, '0')}`;
        await prisma.patient.create({
          data: {
            userId:      createdUser.id,
            clinicId:    clinic.id,
            firstName:   u.firstName,
            lastName:    u.lastName,
            patientCode,
          },
        });
        console.log(`    patientCode: ${patientCode}`);
      } else if (u.role === 'DENTIST') {
        await prisma.dentist.create({
          data: {
            userId:   createdUser.id,
            clinicId: clinic.id,
          },
        });
      } else if (u.role === 'RECEPTIONIST') {
        await prisma.receptionist.create({
          data: {
            userId:   createdUser.id,
            clinicId: clinic.id,
          },
        });
      }

      console.log(`  Created [${u.role}]: ${u.email}`);
    }
  }

  console.log('\nDone. Password for all users: ' + PASSWORD);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
