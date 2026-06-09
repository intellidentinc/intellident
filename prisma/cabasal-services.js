const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CAB_SERVICES = [
  // General / Preventive
  { name: 'Consultation',                        description: 'Initial or follow-up oral health consultation and examination.',                  duration: 30,  price: 500,    bufferTime: 0  },
  { name: 'Scaling',                             description: 'Professional scaling to remove plaque, tartar, and stains.',                      duration: 60,  price: 800,    bufferTime: 10 },
  { name: 'Fluoride Treatment',                  description: 'Topical fluoride application to strengthen enamel and prevent decay.',            duration: 30,  price: 800,    bufferTime: 5  },
  { name: 'Pit & Fissure Sealant',               description: 'Protective sealant applied to molar grooves to prevent cavities.',               duration: 30,  price: 800,    bufferTime: 5  },

  // Restorative
  { name: 'Tooth Restoration',                   description: 'Direct composite restoration, priced per surface.',                               duration: 45,  price: 800,    bufferTime: 10 },
  { name: 'Temporary Filling',                   description: 'Interim filling to protect a tooth pending definitive treatment.',                duration: 30,  price: 500,    bufferTime: 5  },

  // Surgical
  { name: 'Extraction',                          description: 'Removal of a tooth under local anesthesia.',                                      duration: 30,  price: 800,    bufferTime: 10 },
  { name: 'Odontectomy',                         description: 'Surgical removal of an impacted or partially erupted tooth.',                     duration: 120, price: 8000,   bufferTime: 20 },

  // Endodontics
  { name: 'Root Canal Treatment',                description: 'Removal of infected pulp and sealing of the root canal system, per canal.',      duration: 90,  price: 8000,   bufferTime: 15 },

  // Crowns & Bridges
  { name: 'Crown (Plastic)',                     description: 'Plastic crown for temporary or budget tooth restoration, per unit.',              duration: 60,  price: 3500,   bufferTime: 15 },
  { name: 'Crown (PFM)',                         description: 'Porcelain-fused-to-metal crown for durable tooth restoration, per unit.',         duration: 60,  price: 8000,   bufferTime: 15 },
  { name: 'Crown (Tilite)',                      description: 'High-strength Tilite ceramic crown for enhanced aesthetics, per unit.',           duration: 60,  price: 12000,  bufferTime: 15 },
  { name: 'Crown (Emax)',                        description: 'Lithium disilicate all-ceramic crown for superior aesthetics, per unit.',         duration: 60,  price: 15000,  bufferTime: 15 },
  { name: 'Crown (Zirconia)',                    description: 'Ultra-strong zirconia crown for posterior or aesthetic use, per unit.',           duration: 75,  price: 25000,  bufferTime: 15 },

  // Veneers
  { name: 'Veneer (Porcelain)',                  description: 'Traditional porcelain laminate veneer for smile enhancement, per unit.',          duration: 60,  price: 10000,  bufferTime: 15 },
  { name: 'Veneer (Ceramage)',                   description: 'High-strength Ceramage composite veneer for natural aesthetics, per unit.',       duration: 60,  price: 8000,   bufferTime: 15 },
  { name: 'Veneer (Emax)',                       description: 'Lithium disilicate Emax veneer for natural translucency, per unit.',              duration: 60,  price: 12000,  bufferTime: 15 },
  { name: 'Veneer (Zirconia)',                   description: 'Durable zirconia veneer for long-lasting aesthetics, per unit.',                  duration: 75,  price: 20000,  bufferTime: 15 },

  // Removable Partial Denture
  { name: 'Partial Denture (1 Piece Casting)',   description: 'Cast metal removable partial denture for full-arch support.',                    duration: 60,  price: 15000,  bufferTime: 15 },
  { name: 'Partial Denture (Unilateral)',        description: 'Removable partial denture replacing teeth on one side.',                          duration: 60,  price: 8000,   bufferTime: 15 },
  { name: 'Partial Denture (Stayplate 3–5)',     description: 'Stayplate partial denture replacing 3–5 units.',                                  duration: 60,  price: 5000,   bufferTime: 15 },
  { name: 'Partial Denture (Flexite Unilateral)','description': 'Flexible Flexite partial denture replacing teeth on one side.',                 duration: 60,  price: 10000,  bufferTime: 15 },
  { name: 'Partial Denture (Flexite Bilateral)', description: 'Flexible Flexite partial denture replacing teeth on both sides.',                 duration: 60,  price: 20000,  bufferTime: 15 },

  // Complete Denture
  { name: 'Complete Denture (Plastic)',          description: 'Full removable prosthesis for an arch with no remaining teeth (plastic base).',  duration: 60,  price: 15000,  bufferTime: 15 },
  { name: 'Complete Denture (Ivocap)',           description: 'Injection-molded Ivocap complete denture for superior fit and durability.',      duration: 60,  price: 50000,  bufferTime: 15 },
  { name: 'Complete Denture (Thermosen)',        description: 'Thermosen complete denture for enhanced aesthetics and comfort.',                 duration: 60,  price: 50000,  bufferTime: 15 },

  // Orthodontics
  { name: 'Basic Orthodontics',                  description: 'Standard braces treatment for bite correction and teeth alignment.',              duration: 90,  price: 50000,  bufferTime: 15 },
  { name: 'Retainer',                            description: 'Post-orthodontic retainer to maintain tooth alignment, per arch.',               duration: 30,  price: 5000,   bufferTime: 5  },
];

async function main() {
  const clinic = await prisma.clinic.findFirst({ where: { code: 'CAB' } });
  if (!clinic) {
    console.error('Cabasal Dental Clinic (CAB) not found.');
    process.exit(1);
  }
  console.log(`Found clinic: ${clinic.name} (${clinic.id})`);

  // Hard-delete all existing services (resolve FK constraints first)
  const existing = await prisma.service.findMany({ where: { clinicId: clinic.id }, select: { id: true } });
  const ids = existing.map(s => s.id);
  if (ids.length) {
    await prisma.appointmentService.deleteMany({ where: { serviceId: { in: ids } } });
    for (const id of ids) {
      await prisma.service.update({ where: { id }, data: { dentists: { set: [] } } });
    }
  }
  const deleted = await prisma.service.deleteMany({ where: { clinicId: clinic.id } });
  console.log(`Deleted ${deleted.count} existing service(s).`);

  // Insert updated services
  for (const svc of CAB_SERVICES) {
    await prisma.service.create({
      data: { clinicId: clinic.id, ...svc },
    });
  }
  console.log(`Created ${CAB_SERVICES.length} new service(s) for Cabasal Dental Clinic.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
