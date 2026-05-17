const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

// Role hierarchy: 1=ADMIN, 2=DENTIST, 3=RECEPTIONIST, 4=PATIENT
const ROLES = { ADMIN: 1, DENTIST: 2, RECEPTIONIST: 3, PATIENT: 4 };

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

const SERVICES = [
  { name: 'Dental Consultation',           description: 'Initial or follow-up consultation and oral examination.',            duration: 30,  price: 350,    bufferTime: 0  },
  { name: 'Dental Cleaning (Prophylaxis)', description: 'Professional scaling and polishing to remove plaque and tartar.',   duration: 60,  price: 700,    bufferTime: 10 },
  { name: 'Tooth Extraction (Simple)',     description: 'Removal of a visible, erupted tooth under local anesthesia.',       duration: 30,  price: 800,    bufferTime: 10 },
  { name: 'Tooth Extraction (Surgical)',   description: 'Removal of impacted or broken-down teeth requiring surgery.',       duration: 60,  price: 2500,   bufferTime: 15 },
  { name: 'Composite Filling',             description: 'Tooth-colored resin restoration for cavities.',                     duration: 45,  price: 1500,   bufferTime: 10 },
  { name: 'Root Canal Treatment',          description: 'Removal of infected pulp and sealing of the root canal system.',   duration: 90,  price: 7000,   bufferTime: 15 },
  { name: 'Teeth Whitening',              description: 'In-office bleaching treatment for a brighter smile.',               duration: 90,  price: 5000,   bufferTime: 15 },
  { name: 'Dental Crown',                  description: 'Porcelain or metal-ceramic crown to restore a damaged tooth.',      duration: 60,  price: 8000,   bufferTime: 15 },
  { name: 'Denture (Complete)',            description: 'Full removable prosthesis for patients with no remaining teeth.',   duration: 60,  price: 18000,  bufferTime: 15 },
  { name: 'Orthodontic Consultation',      description: 'Assessment and treatment planning for braces or aligners.',         duration: 45,  price: 500,    bufferTime: 10 },
];

const clinics = [
  { name: 'Maria Laura Cruz Dental Clinic', address: 'Quezon City', code: 'MLC' },
  { name: 'KH Dental Aesthetics',           address: 'Makati City', code: 'KH'  },
  { name: 'Cabasal Dental Clinic',          address: 'Pasig City',  code: 'CAB' },
];

const PASSWORD = '12345678';

function usersForClinic(slug) {
  return [
    { firstName: 'Admin',        lastName: slug, email: `admin.${slug}@intellident.test`,         role: ROLES.ADMIN },
    { firstName: 'Receptionist', lastName: slug, email: `receptionist.${slug}@intellident.test`,  role: ROLES.RECEPTIONIST },
    { firstName: 'Dentist',      lastName: slug, email: `dentist.${slug}@intellident.test`,       role: ROLES.DENTIST },
    { firstName: 'Dentist2',     lastName: slug, email: `dentist2.${slug}@intellident.test`,      role: ROLES.DENTIST },
    { firstName: 'Dentist3',     lastName: slug, email: `dentist3.${slug}@intellident.test`,      role: ROLES.DENTIST },
    { firstName: 'Dentist4',     lastName: slug, email: `dentist4.${slug}@intellident.test`,      role: ROLES.DENTIST },
    { firstName: 'Patient',      lastName: slug, email: `patient.${slug}@intellident.test`,       role: ROLES.PATIENT },
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
        if (u.role === ROLES.PATIENT) {
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
        } else if (u.role === ROLES.DENTIST) {
          const hasProfile = await prisma.dentist.findUnique({ where: { userId: existing.id } });
          if (!hasProfile) {
            await prisma.dentist.create({ data: { userId: existing.id, clinicId: clinic.id } });
            console.log(`  Backfilled Dentist profile: ${u.email}`);
          }
        } else if (u.role === ROLES.RECEPTIONIST) {
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
      if (u.role === ROLES.PATIENT) {
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
      } else if (u.role === ROLES.DENTIST) {
        await prisma.dentist.create({
          data: {
            userId:   createdUser.id,
            clinicId: clinic.id,
          },
        });
      } else if (u.role === ROLES.RECEPTIONIST) {
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

  // Seed services per clinic
  for (const clinic of clinicRecords) {
    for (const svc of SERVICES) {
      const existing = await prisma.service.findFirst({
        where: { clinicId: clinic.id, name: svc.name, isDeleted: false },
      });
      if (existing) {
        console.log(`  Skip service (exists): ${svc.name} [${clinic.code}]`);
        continue;
      }
      await prisma.service.create({ data: { clinicId: clinic.id, ...svc } });
      console.log(`  Created service: ${svc.name} [${clinic.code}]`);
    }
  }

  // Randomly assign services to dentists (skip if dentist already has services)
  for (const clinic of clinicRecords) {
    const [clinicDentists, clinicServices] = await Promise.all([
      prisma.dentist.findMany({
        where: { clinicId: clinic.id, isDeleted: false },
        include: { services: { select: { id: true } } },
      }),
      prisma.service.findMany({
        where: { clinicId: clinic.id, isDeleted: false },
        select: { id: true, name: true },
      }),
    ]);

    for (const dentist of clinicDentists) {
      if (dentist.services.length > 0) {
        console.log(`  Skip service assignment (already set): dentist ${dentist.id} [${clinic.code}]`);
        continue;
      }

      // Shuffle and pick 3–6 random services
      const shuffled = [...clinicServices].sort(() => Math.random() - 0.5);
      const count = 3 + Math.floor(Math.random() * 4); // 3, 4, 5, or 6
      const assigned = shuffled.slice(0, count);

      await prisma.dentist.update({
        where: { id: dentist.id },
        data: { services: { connect: assigned.map(s => ({ id: s.id })) } },
      });
      console.log(`  Assigned ${assigned.length} services to dentist ${dentist.id} [${clinic.code}]: ${assigned.map(s => s.name).join(', ')}`);
    }
  }

  console.log('\nDone. Password for all users: ' + PASSWORD);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
