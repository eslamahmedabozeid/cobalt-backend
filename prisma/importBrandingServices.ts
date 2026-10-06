/**
 * Dedicated import: add/update ONLY the five branding services.
 * Does NOT run the general seed. Does NOT modify other services' active flags.
 */
import { PrismaClient } from '@prisma/client';
import { BRANDING_SERVICES } from './brandingServices';

const prisma = new PrismaClient();

async function main() {
  await prisma.category.upsert({
    where: { id: 'branding' },
    update: { name: 'الهوية البصرية', icon: '🎨', active: true },
    create: {
      id: 'branding',
      name: 'الهوية البصرية',
      icon: '🎨',
      sortOrder: 6,
      active: true,
    },
  });

  for (const s of BRANDING_SERVICES) {
    const { packages, form, deliverables, ...svc } = s;

    await prisma.service.upsert({
      where: { id: svc.id },
      update: {
        ...svc,
        deliverables: JSON.stringify(deliverables),
      },
      create: {
        ...svc,
        deliverables: JSON.stringify(deliverables),
      },
    });

    for (const p of packages) {
      await prisma.servicePackage.upsert({
        where: { id: p.id },
        update: { ...p, serviceId: svc.id },
        create: { ...p, serviceId: svc.id },
      });
    }

    await prisma.serviceRequirementSchema.upsert({
      where: { serviceId: svc.id },
      update: { schemaJson: JSON.stringify(form), version: 2 },
      create: {
        serviceId: svc.id,
        schemaJson: JSON.stringify(form),
        version: 2,
      },
    });

    console.log(`✓ ${svc.slug} @ ${svc.priceSAR} SAR (active=${svc.active})`);
  }

  const active = await prisma.service.findMany({
    where: { active: true },
    select: { slug: true, title: true, priceSAR: true },
    orderBy: { sortOrder: 'asc' },
  });
  const inactive = await prisma.service.count({ where: { active: false } });
  console.log(`Active services: ${active.length}`);
  for (const a of active) console.log(`  - ${a.slug}: ${a.title} (${a.priceSAR})`);
  console.log(`Inactive services preserved: ${inactive}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
