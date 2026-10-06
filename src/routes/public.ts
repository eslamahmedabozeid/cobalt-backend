import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { ok, fail } from '../utils/response';
import { createOrder, estimateOrder } from '../services/orders';
import { applyCoupon } from '../services/pricing';
import { orderFileUpload } from '../lib/orderFiles';

const router = Router();

function parseJsonField<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

router.get('/categories', async (_req, res) => {
  const items = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (items.length) {
    return ok(res, items.map((c) => ({ id: c.id, name: c.name, icon: c.icon })));
  }
  // fallback: derive from services
  const services = await prisma.service.findMany({
    where: { active: true },
    select: { category: true, categoryName: true },
    orderBy: { sortOrder: 'asc' },
  });
  const map = new Map<string, { id: string; name: string }>();
  for (const s of services) {
    if (!map.has(s.category)) {
      map.set(s.category, { id: s.category, name: s.categoryName });
    }
  }
  return ok(res, Array.from(map.values()));
});

router.get('/health', (_req, res) => ok(res, { status: 'ok' }));

router.get('/services', async (_req, res) => {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      packages: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      addons: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      requirementSchema: true,
    },
  });
  return ok(
    res,
    services.map((s) => ({
      ...s,
      deliverables: parseJsonField(s.deliverables, [] as string[]),
      requirementSchema: s.requirementSchema
        ? parseJsonField(s.requirementSchema.schemaJson, {})
        : null,
    }))
  );
});

router.get('/services/:slug', async (req, res) => {
  const service = await prisma.service.findFirst({
    where: { slug: req.params.slug, active: true },
    include: {
      packages: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      addons: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      requirementSchema: true,
    },
  });
  if (!service) return fail(res, 'Service not found', 404, undefined, 'NOT_FOUND');
  return ok(res, {
    ...service,
    deliverables: parseJsonField(service.deliverables, [] as string[]),
    requirementSchema: service.requirementSchema
      ? parseJsonField(service.requirementSchema.schemaJson, {})
      : null,
  });
});

router.get('/bundles', async (_req, res) => {
  const bundles = await prisma.bundle.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return ok(res, bundles);
});

router.get('/calculator', async (_req, res) => {
  const calc = await prisma.calculatorConfig.findUnique({ where: { id: 'default' } });
  if (!calc) return fail(res, 'Calculator config missing', 404);
  return ok(res, calc);
});

router.get('/coupons/validate', async (req, res) => {
  const code = String(req.query.code || '');
  try {
    // validate against a dummy subtotal of 100 to check existence/active
    const result = await applyCoupon(code, 100);
    if (!result.couponCode) return fail(res, 'Coupon required', 400);
    const coupon = await prisma.coupon.findUnique({ where: { code: result.couponCode } });
    return ok(res, {
      code: coupon!.code,
      discountPercentage: coupon!.discountPercentage,
      valid: true,
    });
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Invalid coupon', 400, undefined, 'INVALID_COUPON');
  }
});

router.get('/hero-slides', async (_req, res) => {
  const slides = await prisma.heroSlide.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return ok(res, slides);
});

router.get('/portfolio', async (_req, res) => {
  const items = await prisma.portfolioItem.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return ok(
    res,
    items.map((i) => ({ ...i, features: parseJsonField(i.features, [] as string[]) }))
  );
});

router.get('/testimonials', async (_req, res) => {
  const items = await prisma.testimonial.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return ok(res, items);
});

router.get('/faqs', async (_req, res) => {
  const items = await prisma.faq.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return ok(res, items);
});

router.get('/site-settings', async (_req, res) => {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
  if (!settings) return fail(res, 'Settings not found', 404);
  return ok(res, {
    ...settings,
    paymentBadges: parseJsonField(settings.paymentBadges, [] as string[]),
  });
});

router.get('/currencies', async (_req, res) => {
  const currencies = await prisma.currency.findMany({
    where: { active: true },
    orderBy: { code: 'asc' },
  });
  return ok(res, currencies);
});

router.post('/pricing/estimate', async (req, res) => {
  try {
    const estimate = await estimateOrder(req.body);
    return ok(res, estimate);
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Estimate failed', 400, undefined, 'PRICING_ERROR');
  }
});

router.post('/orders', async (req, res) => {
  try {
    const order = await createOrder(req.body);
    return ok(
      res,
      {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        subtotalSAR: order.subtotalSAR,
        discountSAR: order.discountSAR,
        totalSAR: order.totalSAR,
        couponCode: order.couponCode,
        items: order.items,
        files: order.files,
      },
      201
    );
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Order failed', 400, undefined, 'ORDER_ERROR');
  }
});

/** Public customer questionnaire file upload (images / PDF / Word). */
router.post('/order-files', (req, res) => {
  orderFileUpload.single('file')(req, res, async (err) => {
    if (err) return fail(res, err.message, 400, undefined, 'UPLOAD_ERROR');
    if (!req.file) return fail(res, 'No file uploaded', 400);

    const fieldId = String(req.body?.fieldId || '');
    const url = `/uploads/order-files/${req.file.filename}`;
    const asset = await prisma.orderFile.create({
      data: {
        fieldId,
        filename: req.file.originalname,
        storedName: req.file.filename,
        url,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    return ok(
      res,
      {
        id: asset.id,
        name: asset.filename,
        url: asset.url,
        size: asset.size,
        mimeType: asset.mimeType,
        fieldId: asset.fieldId,
      },
      201
    );
  });
});

export default router;
