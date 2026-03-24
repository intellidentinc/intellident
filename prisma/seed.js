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
  { name: 'Maria Laura Cruz Dental Clinic', address: 'Quezon City' },
  { name: 'KH Dental Aesthetics',           address: 'Makati City' },
  { name: 'Cabasal Dental Clinic',          address: 'Pasig City' },
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
      console.log(`Clinic exists:  ${record.name}`);
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
        console.log(`  Skip (exists): ${u.email}`);
        continue;
      }

      const { wrappedKey, keySalt } = await generateKeyMaterial(PASSWORD);

      await prisma.user.create({
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

      console.log(`  Created [${u.role}]: ${u.email}`);
    }
  }

  console.log('\nDone. Password for all users: ' + PASSWORD);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
