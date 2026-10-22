/**
 * Apply Business Cards v1.0 pricing + form to live DB.
 * Updates only the business-cards service (does not touch other services).
 *
 *   npx tsx prisma/applyBusinessCardsV1.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  BUSINESS_CARDS_SERVICE_ID,
  BUSINESS_CARDS_FORM_V1,
  DEFAULT_BUSINESS_CARDS_PRICING,
} from '../src/services/businessCardsPricing';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.service.findUnique({
    where: { id: BUSINESS_CARDS_SERVICE_ID },
    include: { packages: true, requirementSchema: true },
  });
  if (!existing) {
    throw new Error(
      `Service ${BUSINESS_CARDS_SERVICE_ID} not found. Import branding services first.`
    );
  }

  await prisma.service.update({
    where: { id: BUSINESS_CARDS_SERVICE_ID },
    data: {
      title: 'تصميم كروت الأعمال',
      badge: '💳 كروت أعمال',
      delivery: '⚡ تسليم قياسي 2–3 أيام عمل',
      priceSAR: DEFAULT_BUSINESS_CARDS_PRICING.baseLaunchSAR,
      oldPriceSAR: DEFAULT_BUSINESS_CARDS_PRICING.baseRegularSAR,
      shortDesc:
        'تصميم كرت أعمال مزدوج الوجه — تصميم رقمي فقط. يبدأ من 149 ر.س أثناء عرض الإطلاق.',
      deliverables: JSON.stringify([
        'وجه وظهر مشمولان',
        'ملفات رقمية PNG/PDF',
        'ملف طباعة جاهز عند الطلب (بدون رسوم)',
        'تعديلات ضمن النطاق',
      ]),
      pricingConfigJson: JSON.stringify(DEFAULT_BUSINESS_CARDS_PRICING),
    },
  });

  const pkg = existing.packages.find((p) => p.id === 'business_cards_basic');
  if (pkg) {
    await prisma.servicePackage.update({
      where: { id: pkg.id },
      data: {
        name: 'باقة تصميم الكروت',
        priceSAR: DEFAULT_BUSINESS_CARDS_PRICING.baseLaunchSAR,
        description:
          'السعر يبدأ من 149 ر.س (عرض الإطلاق) لشخص واحد مزدوج الوجه؛ يُحتسب الإجمالي من خياراتك.',
      },
    });
  }

  const schemaJson = JSON.stringify(BUSINESS_CARDS_FORM_V1);
  if (existing.requirementSchema) {
    await prisma.serviceRequirementSchema.update({
      where: { serviceId: BUSINESS_CARDS_SERVICE_ID },
      data: {
        schemaJson,
        version: { increment: 1 },
      },
    });
  } else {
    await prisma.serviceRequirementSchema.create({
      data: {
        serviceId: BUSINESS_CARDS_SERVICE_ID,
        schemaJson,
        version: 1,
      },
    });
  }

  const verify = await prisma.service.findUnique({
    where: { id: BUSINESS_CARDS_SERVICE_ID },
    include: { requirementSchema: true },
  });
  const parsed = verify?.requirementSchema
    ? JSON.parse(verify.requirementSchema.schemaJson)
    : null;
  console.log(
    JSON.stringify(
      {
        ok: true,
        serviceId: BUSINESS_CARDS_SERVICE_ID,
        priceSAR: verify?.priceSAR,
        oldPriceSAR: verify?.oldPriceSAR,
        schemaVersion: verify?.requirementSchema?.version,
        steps: parsed?.stepLabels,
        sectionCount: parsed?.sections?.length,
        hasPricingConfig: Boolean(verify?.pricingConfigJson),
      },
      null,
      2
    )
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
