/**
 * seed-team.js
 * Seeds the three capstone team member accounts across all three clinics.
 *
 * Usage:
 *   node prisma/seed-team.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const ROLES = { ADMIN: 1, DENTIST: 2, RECEPTIONIST: 3, PATIENT: 4 };
const PASSWORD = '12345678';

const prisma = new PrismaClient();
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

// Team members: email → { firstName, lastName, role, clinicCode }
const TEAM = [
  {
    email: '20.garciajohnjoshua@gmail.com',
    firstName: 'John Joshua',
    lastName: 'Garcia',
    role: ROLES.ADMIN,
    clinicCode: 'MLC',
  },
  {
    email: 'daneborja324@gmail.com',
    firstName: 'Dane',
    lastName: 'Borja',
    role: ROLES.DENTIST,
    clinicCode: 'KH',
  },
  {
    email: 'armamentow@gmail.com',
    firstName: 'W.',
    lastName: 'Armamento',
    role: ROLES.RECEPTIONIST,
    clinicCode: 'CAB',
  },
];

const ROLE_LABEL = { 1: 'ADMIN', 2: 'DENTIST', 3: 'RECEPTIONIST', 4: 'PATIENT' };

async function main() {
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  for (const member of TEAM) {
    const clinic = await prisma.clinic.findFirst({ where: { code: member.clinicCode } });
    if (!clinic) {
      console.error(`  ✗ Clinic not found for code: ${member.clinicCode} — run the main seed first.`);
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email: member.email } });
    if (existing) {
      console.log(`  Skip (exists): ${member.email}`);
      continue;
    }

    const { wrappedKey, keySalt } = await generateKeyMaterial(PASSWORD);

    const user = await prisma.user.create({
      data: {
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        password: hashedPassword,
        passwordHistory: [hashedPassword],
        role: member.role,
        clinicId: clinic.id,
        wrappedKey,
        keySalt,
      },
    });

    if (member.role === ROLES.PATIENT) {
      const year = new Date().getFullYear();
      const count = await prisma.patient.count({ where: { clinicId: clinic.id } });
      const patientCode = `PAT-${clinic.code}-${year}-${String(count + 1).padStart(5, '0')}`;
      await prisma.patient.create({
        data: { userId: user.id, clinicId: clinic.id, firstName: member.firstName, lastName: member.lastName, patientCode },
      });
      console.log(`  ✓ Created [${ROLE_LABEL[member.role]}]: ${member.email} @ ${clinic.name} (${patientCode})`);
    } else if (member.role === ROLES.DENTIST) {
      await prisma.dentist.create({ data: { userId: user.id, clinicId: clinic.id } });
      console.log(`  ✓ Created [${ROLE_LABEL[member.role]}]: ${member.email} @ ${clinic.name}`);
    } else if (member.role === ROLES.RECEPTIONIST) {
      await prisma.receptionist.create({ data: { userId: user.id, clinicId: clinic.id } });
      console.log(`  ✓ Created [${ROLE_LABEL[member.role]}]: ${member.email} @ ${clinic.name}`);
    } else {
      console.log(`  ✓ Created [${ROLE_LABEL[member.role]}]: ${member.email} @ ${clinic.name}`);
    }
  }

  console.log('\nDone. Password for all accounts: ' + PASSWORD);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
