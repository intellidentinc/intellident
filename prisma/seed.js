const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const clinics = [
  {
    name: 'Maria Laura Cruz Dental Clinic',
    address: 'Quezon City',
  },
  {
    name: 'KH Dental Aesthetics',
    address: 'Makati City',
  },
  {
    name: 'Cabasal Dental Clinic',
    address: 'Pasig City',
  },
];

async function main() {
  for (const clinic of clinics) {
    const existing = await prisma.clinic.findFirst({ where: { name: clinic.name } });
    if (!existing) {
      await prisma.clinic.create({ data: clinic });
      console.log(`Created: ${clinic.name}`);
    } else {
      console.log(`Already exists: ${clinic.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
