/**
 * prisma/seed-records.js
 * Seeds sample PatientRecord entries for testing the My Dental Records page.
 * Run: node prisma/seed-records.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find the first patient across all clinics
  const patients = await prisma.patient.findMany({
    where: { isDeleted: false },
    take: 3,
    include: { user: { select: { email: true } } }
  })

  if (patients.length === 0) {
    console.log('No patients found. Run the main seed first: npx prisma db seed')
    return
  }

  const records = [
    {
      title: 'Initial Dental Examination',
      status: 'ACTIVE',
      daysAgo: 90
    },
    {
      title: 'Tooth Extraction — Lower Left Molar',
      status: 'ACTIVE',
      daysAgo: 60
    },
    {
      title: 'Dental Cleaning & Scaling',
      status: 'ACTIVE',
      daysAgo: 45
    },
    {
      title: 'Root Canal Treatment — Upper Right',
      status: 'ACTIVE',
      daysAgo: 30
    },
    {
      title: 'Teeth Whitening Session',
      status: 'ACTIVE',
      daysAgo: 14
    },
    {
      title: 'Cavity Filling — Lower Right Premolar',
      status: 'ACTIVE',
      daysAgo: 120
    },
  ]

  let created = 0

  for (const patient of patients) {
    console.log(`\nSeeding records for patient: ${patient.user.email} (${patient.firstName} ${patient.lastName})`)

    for (const rec of records) {
      const createdAt = new Date(Date.now() - rec.daysAgo * 24 * 60 * 60 * 1000)

      await prisma.patientRecord.create({
        data: {
          patientId: patient.id,
          clinicId: patient.clinicId,
          title: rec.title,
          status: rec.status,
          createdAt,
          updatedAt: createdAt,
        }
      })

      console.log(`  ✓ ${rec.title}`)
      created++
    }
  }

  console.log(`\nDone. Created ${created} records across ${patients.length} patients.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
