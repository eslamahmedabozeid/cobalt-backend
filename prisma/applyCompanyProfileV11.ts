/**
 * Targeted update: company-profile pricing/metadata only.
 * Does NOT touch ServiceRequirementSchema (Admin form is authoritative).
 * Does NOT run the general seed or touch other services.
 */
import { PrismaClient } from '@prisma/client';
import {
  COMPANY_PROFILE_SERVICE_ID,
  DEFAULT_COMPANY_PROFILE_PRICING,
} from '../src/services/companyProfilePricing';

const prisma = new PrismaClient();

const STARTING_PRICE = 350; // promo starting-from
const STANDARD_STARTING = 490;

async function main() {
  const existing = await prisma.service.findUnique({
    where: { id: COMPANY_PROFILE_SERVICE_ID },
    include: { packages: true },
  });
  if (!existing) {
    throw new Error(`Service ${COMPANY_PROFILE_SERVICE_ID} not found — aborting (will not create)`);
  }

  const pricingJson = JSON.stringify(DEFAULT_COMPANY_PROFILE_PRICING);

  await prisma.service.update({
    where: { id: COMPANY_PROFILE_SERVICE_ID },
    data: {
      priceSAR: STARTING_PRICE,
      oldPriceSAR: STANDARD_STARTING,
      badge: '🎁 عرض الإطلاق',
      delivery: '⚡ تسليم قياسي 3–5 أيام عمل',
      shortDesc:
        'تصميم بروفايل شركة احترافي بتسعير ديناميكي حسب الصفحات واللغة والمحتوى. يبدأ من 350 ر.س أثناء عرض الإطلاق.',
      deliverables: JSON.stringify([
        'تصميم صفحات البروفايل حسب الشريحة المختارة',
        'ملفات PDF عالية الجودة للعرض والطباعة',
        'جولتان من التعديلات التصميمية ضمن النطاق',
        'ملف مصدر .ai اختياري برسوم إضافية',
      ]),
      pricingConfigJson: pricingJson,
    },
  });

  const pkg = existing.packages.find((p) => p.id === 'company_profile_basic') || existing.packages[0];
  if (pkg) {
    await prisma.servicePackage.update({
      where: { id: pkg.id },
      data: {
        name: 'باقة بروفايل الشركة (تسعير ديناميكي)',
        priceSAR: STARTING_PRICE,
        description:
          'السعر يبدأ من الباقة الأساسية (1–4 صفحات، لغة واحدة، محتوى جاهز، هوية جاهزة، PDF). يُحتسب الإجمالي النهائي من إجاباتك.',
      },
    });
  }

  console.log(
    `✓ ${COMPANY_PROFILE_SERVICE_ID}: price ${STARTING_PRICE} (was ${existing.priceSAR}), promo on; schema left unchanged`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
