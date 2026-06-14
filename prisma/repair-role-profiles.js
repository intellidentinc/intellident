/**
 * prisma/repair-role-profiles.js — one-time data repair
 *
 * Fixes users whose role no longer matches their profile rows — the result of
 * role conversions done before the role-update endpoint became transactional
 * (e.g. a user with role=DENTIST but no Dentist row and a stale active Patient row).
 *
 * Mirrors lib/userProfiles.reconcileRoleProfile + lib/patients.generatePatientCode
 * in CommonJS so it runs with: `node prisma/repair-role-profiles.js`. Idempotent.
 */

const { PrismaClient } = require('@prisma/client');

const ROLES = { SUPERADMIN: 0, ADMIN: 1, DENTIST: 2, RECEPTIONIST: 3, PATIENT: 4 };

const prisma = new PrismaClient();

async function generatePatientCode(clinicId, tx) {
  const clinic = await tx.clinic.findUnique({ where: { id: clinicId }, select: { code: true } });
  const year = new Date().getFullYear();
  const existingCount = await tx.patient.count({ where: { clinicId } });
  return `PAT-${clinic?.code ?? 'CLN'}-${year}-${String(existingCount + 1).padStart(5, '0')}`;
}

async function reconcileRoleProfile(tx, { userId, role, clinicId, firstName, lastName }) {
  if (role !== ROLES.PATIENT) {
    await tx.patient.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true, deletedAt: new Date() } });
  }
  if (role !== ROLES.DENTIST) {
    await tx.dentist.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true, deletedAt: new Date() } });
  }
  if (role !== ROLES.RECEPTIONIST) {
    await tx.receptionist.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true, deletedAt: new Date() } });
  }

  if (role === ROLES.DENTIST) {
    const existing = await tx.dentist.findUnique({ where: { userId }, select: { id: true } });
    if (existing) {
      await tx.dentist.update({ where: { userId }, data: { isDeleted: false, deletedAt: null, clinicId } });
    } else {
      await tx.dentist.create({ data: { userId, clinicId } });
    }
  } else if (role === ROLES.RECEPTIONIST) {
    const existing = await tx.receptionist.findUnique({ where: { userId }, select: { id: true } });
    if (existing) {
      await tx.receptionist.update({ where: { userId }, data: { isDeleted: false, deletedAt: null, clinicId } });
    } else {
      await tx.receptionist.create({ data: { userId, clinicId } });
    }
  } else if (role === ROLES.PATIENT) {
    const existing = await tx.patient.findUnique({ where: { userId }, select: { id: true } });
    if (existing) {
      await tx.patient.update({ where: { userId }, data: { isDeleted: false, deletedAt: null, clinicId } });
    } else {
      const patientCode = await generatePatientCode(clinicId, tx);
      await tx.patient.create({
        data: { userId, clinicId, firstName: firstName || '', lastName: lastName || '', patientCode },
      });
    }
  }
}

function activeProfileMatches(user) {
  const dentistActive = user.dentist && !user.dentist.isDeleted;
  const receptionistActive = user.receptionist && !user.receptionist.isDeleted;
  const patientActive = user.patient && !user.patient.isDeleted;

  const hasCorrect =
    (user.role === ROLES.DENTIST && dentistActive) ||
    (user.role === ROLES.RECEPTIONIST && receptionistActive) ||
    (user.role === ROLES.PATIENT && patientActive);

  const hasStale =
    (user.role !== ROLES.DENTIST && dentistActive) ||
    (user.role !== ROLES.RECEPTIONIST && receptionistActive) ||
    (user.role !== ROLES.PATIENT && patientActive);

  return hasCorrect && !hasStale;
}

async function main() {
  const users = await prisma.user.findMany({
    where: { isDeleted: false, role: { in: [ROLES.DENTIST, ROLES.RECEPTIONIST, ROLES.PATIENT] } },
    select: {
      id: true, email: true, role: true, clinicId: true, firstName: true, lastName: true,
      dentist: { select: { isDeleted: true } },
      receptionist: { select: { isDeleted: true } },
      patient: { select: { isDeleted: true } },
    },
  });

  const broken = users.filter((u) => u.clinicId && !activeProfileMatches(u));

  if (broken.length === 0) {
    console.log('No role/profile mismatches found. Nothing to repair.');
    return;
  }

  console.log(`Found ${broken.length} user(s) to repair:`);
  for (const u of broken) {
    await prisma.$transaction((tx) =>
      reconcileRoleProfile(tx, {
        userId: u.id,
        role: u.role,
        clinicId: u.clinicId,
        firstName: u.firstName,
        lastName: u.lastName,
      })
    );
    console.log(`  fixed ${u.email} (role ${u.role})`);
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
