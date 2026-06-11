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
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
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

  // Asymmetric envelope keypair: public key stored plaintext, private key encrypted
  // under the master key (mirrors lib/crypto.js generateKeyPair/encryptPrivateKey).
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['wrapKey', 'unwrapKey']
  );
  const publicKey = toBase64(await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey));
  const pkcs8 = await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const privIv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encryptedPrivateKey = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: privIv }, masterKey, pkcs8);

  return {
    wrappedKey: toBase64(wrapped),
    keySalt: toBase64(salt),
    publicKey,
    encryptedPrivateKey: toBase64(encryptedPrivateKey),
    privateKeyIv: toBase64(privIv),
  };
}

// Backfills an envelope keypair onto a pre-existing seeded user (whose password is
// the known seed PASSWORD). Derives the master key from PASSWORD + stored keySalt,
// then generates a keypair and stores the private key encrypted under the master key.
// Returns false (no-op) for users already provisioned or whose password isn't PASSWORD
// (real signup users) — those self-provision on next login.
async function backfillKeypairIfMissing(existing, password) {
  if (existing.publicKey || !existing.wrappedKey || !existing.keySalt) return false;
  const salt = Uint8Array.from(Buffer.from(existing.keySalt, 'base64'));
  const keyMaterial = await globalThis.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const kek = await globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-KW', length: 256 }, false, ['unwrapKey']
  );
  let masterKey;
  try {
    masterKey = await globalThis.crypto.subtle.unwrapKey(
      'raw', Uint8Array.from(Buffer.from(existing.wrappedKey, 'base64')), kek, 'AES-KW',
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
  } catch {
    return false; // password isn't the seed PASSWORD — leave for lazy login provisioning
  }
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['wrapKey', 'unwrapKey']
  );
  const publicKey = toBase64(await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey));
  const pkcs8 = await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encryptedPrivateKey = toBase64(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, pkcs8));
  await prisma.user.update({ where: { id: existing.id }, data: { publicKey, encryptedPrivateKey, privateKeyIv: toBase64(iv) } });
  return true;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

// Maria Laura Cruz Dental Clinic — General Dentistry & Orthodontics
const MLC_SERVICES = [
  { name: 'Oral Prophylaxis',                description: 'Professional scaling and polishing to remove plaque and tartar.',                  duration: 60,  price: 1000,   bufferTime: 10 },
  { name: 'Deep Scaling',                    description: 'Deep cleaning below the gumline, priced per quadrant.',                            duration: 60,  price: 1000,   bufferTime: 10 },
  { name: 'Light Cured Filling',             description: 'Tooth-colored light-cured composite restoration, priced per surface.',             duration: 45,  price: 1000,   bufferTime: 10 },
  { name: 'Simple Extraction',               description: 'Removal of a visible, erupted tooth under local anesthesia.',                      duration: 30,  price: 1000,   bufferTime: 10 },
  { name: 'Extraction (Ankylosed)',          description: 'Removal of an ankylosed or fused tooth requiring additional technique.',           duration: 60,  price: 2000,   bufferTime: 15 },
  { name: 'Simple Surgical Procedure',       description: 'Minor oral surgical procedure under local anesthesia.',                            duration: 90,  price: 5000,   bufferTime: 15 },
  { name: 'Odontectomy (Wisdom Tooth)',      description: 'Surgical removal of an impacted wisdom tooth.',                                    duration: 120, price: 10000,  bufferTime: 20 },
  { name: 'Complete Denture',                description: 'Full removable prosthesis for an arch with no remaining teeth, priced per arch.',  duration: 60,  price: 10000,  bufferTime: 15 },
  { name: 'Ivocap Denture',                  description: 'High-precision injection-molded complete denture, priced per arch.',               duration: 60,  price: 20000,  bufferTime: 15 },
  { name: 'Partial Denture',                 description: 'Removable partial prosthesis to replace missing teeth, priced per arch.',          duration: 60,  price: 7000,   bufferTime: 15 },
  { name: 'Valplast (Unilateral)',           description: 'Flexible resin partial denture replacing teeth on one side.',                      duration: 60,  price: 10000,  bufferTime: 15 },
  { name: 'Valplast (Bilateral)',            description: 'Flexible resin partial denture replacing teeth on both sides.',                    duration: 60,  price: 15000,  bufferTime: 15 },
  { name: 'Valplast with Metal Framework',   description: 'Flexible partial denture reinforced with a metal framework.',                      duration: 75,  price: 20000,  bufferTime: 15 },
  { name: 'Porcelain Jacket Crown',          description: 'Full porcelain-over-metal crown to restore a damaged tooth, priced per unit.',     duration: 60,  price: 7000,   bufferTime: 15 },
  { name: 'Tilite Porcelain Crown',          description: 'High-strength Tilite ceramic crown for superior aesthetics, priced per unit.',     duration: 60,  price: 8000,   bufferTime: 15 },
  { name: 'All Porcelain Crown',             description: 'Full all-ceramic crown for optimal aesthetics, priced per unit.',                  duration: 60,  price: 12000,  bufferTime: 15 },
  { name: 'Orthodontics (Corrective)',       description: 'Full corrective braces treatment for significant bite or alignment issues.',       duration: 90,  price: 40000,  bufferTime: 15 },
  { name: 'Orthodontics (Adjunctive)',       description: 'Supplemental orthodontic treatment as part of broader dental care.',              duration: 60,  price: 20000,  bufferTime: 15 },
];

// Cabasal Dental Clinic & KH Dental Aesthetics — shared service catalog
const CAB_KH_SERVICES = [
  { name: 'Consultation',                   description: 'Initial or follow-up oral health consultation and examination.',                   duration: 30,  price: 500,    bufferTime: 0  },
  { name: 'Scaling',                        description: 'Professional scaling to remove plaque, tartar, and stains.',                       duration: 60,  price: 800,    bufferTime: 10 },
  { name: 'Extraction',                     description: 'Removal of a tooth under local anesthesia.',                                       duration: 30,  price: 800,    bufferTime: 10 },
  { name: 'Tooth Restoration',              description: 'Direct composite or amalgam restoration, priced per surface.',                     duration: 45,  price: 800,    bufferTime: 10 },
  { name: 'Temporary Filling',              description: 'Interim filling to protect a tooth pending definitive treatment.',                 duration: 30,  price: 500,    bufferTime: 5  },
  { name: 'Fluoride Treatment',             description: 'Topical fluoride application to strengthen enamel and prevent decay.',            duration: 30,  price: 800,    bufferTime: 5  },
  { name: 'Pit & Fissure Sealant',          description: 'Protective sealant applied to molar grooves to prevent cavities.',               duration: 30,  price: 800,    bufferTime: 5  },
  { name: 'Odontectomy',                    description: 'Surgical removal of an impacted or partially erupted tooth.',                      duration: 120, price: 8000,   bufferTime: 20 },
  { name: 'Root Canal Treatment',           description: 'Removal of infected pulp and sealing of the root canal system, per canal.',       duration: 90,  price: 8000,   bufferTime: 15 },
  { name: 'Crown (PFM)',                    description: 'Porcelain-fused-to-metal crown for durable tooth restoration, per unit.',          duration: 60,  price: 8000,   bufferTime: 15 },
  { name: 'Crown (Tilite)',                 description: 'High-strength Tilite ceramic crown for enhanced aesthetics, per unit.',            duration: 60,  price: 12000,  bufferTime: 15 },
  { name: 'Crown (Emax)',                   description: 'Lithium disilicate all-ceramic crown for superior aesthetics, per unit.',          duration: 60,  price: 15000,  bufferTime: 15 },
  { name: 'Crown (Zirconia)',               description: 'Ultra-strong zirconia crown for posterior or aesthetic use, per unit.',            duration: 75,  price: 25000,  bufferTime: 15 },
  { name: 'Veneer (Porcelain)',             description: 'Traditional porcelain laminate veneer for smile enhancement, per unit.',           duration: 60,  price: 10000,  bufferTime: 15 },
  { name: 'Veneer (Emax)',                  description: 'Lithium disilicate Emax veneer for natural translucency, per unit.',               duration: 60,  price: 12000,  bufferTime: 15 },
  { name: 'Veneer (Zirconia)',              description: 'Durable zirconia veneer for long-lasting aesthetics, per unit.',                   duration: 75,  price: 20000,  bufferTime: 15 },
  { name: 'Partial Denture (Unilateral)',   description: 'Removable partial denture replacing teeth on one side.',                           duration: 60,  price: 8000,   bufferTime: 15 },
  { name: 'Partial Denture (Bilateral Flexite)', description: 'Flexible Flexite partial denture replacing teeth on both sides.',             duration: 60,  price: 20000,  bufferTime: 15 },
  { name: 'Complete Denture',               description: 'Full removable prosthesis for an arch with no remaining teeth (plastic base).',   duration: 60,  price: 15000,  bufferTime: 15 },
  { name: 'Basic Orthodontics',             description: 'Standard braces treatment for bite correction and teeth alignment.',               duration: 90,  price: 50000,  bufferTime: 15 },
  { name: 'Retainer',                       description: 'Post-orthodontic retainer to maintain tooth alignment, priced per arch.',          duration: 30,  price: 5000,   bufferTime: 5  },
];

const SERVICES_BY_CLINIC = {
  MLC: MLC_SERVICES,
  KH:  CAB_KH_SERVICES,
  CAB: CAB_KH_SERVICES,
};

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

  // Remove extra dentist accounts no longer in the seed definition
  for (const clinic of clinicRecords) {
    const slug = clinic.name.split(' ')[0].toLowerCase();
    const extraEmails = ['dentist2', 'dentist3', 'dentist4'].map(
      (n) => `${n}.${slug}@intellident.test`
    );
    const extraUsers = await prisma.user.findMany({
      where: { email: { in: extraEmails } },
      select: { id: true, email: true },
    });
    for (const u of extraUsers) {
      await prisma.dentist.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
      console.log(`  Removed extra dentist: ${u.email}`);
    }
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
        if (await backfillKeypairIfMissing(existing, PASSWORD)) {
          console.log(`  Backfilled envelope keypair: ${u.email}`);
        }
        console.log(`  Skip (exists): ${u.email}`);
        continue;
      }

      const { wrappedKey, keySalt, publicKey, encryptedPrivateKey, privateKeyIv } = await generateKeyMaterial(PASSWORD);

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
          publicKey,
          encryptedPrivateKey,
          privateKeyIv,
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
    for (const svc of (SERVICES_BY_CLINIC[clinic.code] ?? [])) {
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

      await prisma.dentist.update({
        where: { id: dentist.id },
        data: { services: { connect: clinicServices.map(s => ({ id: s.id })) } },
      });
      console.log(`  Assigned all ${clinicServices.length} services to dentist ${dentist.id} [${clinic.code}]`);
    }
  }

  console.log('\nDone. Password for all users: ' + PASSWORD);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
