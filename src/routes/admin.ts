import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { ok, fail } from '../utils/response';
import { requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 'Email and password required', 400);
  const user = await prisma.adminUser.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user) return fail(res, 'Invalid credentials', 401, undefined, 'UNAUTHORIZED');
  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) return fail(res, 'Invalid credentials', 401, undefined, 'UNAUTHORIZED');
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string | number }
  );
  return ok(res, {
    token,
    admin: { id: user.id, email: user.email, name: user.name },
  });
});

router.post('/auth/logout', requireAdmin, (_req, res) => ok(res, { loggedOut: true }));

router.get('/me', requireAdmin, async (req: AuthRequest, res) => {
  const user = await prisma.adminUser.findUnique({ where: { id: req.admin!.id } });
  if (!user) return fail(res, 'Not found', 404);
  return ok(res, { id: user.id, email: user.email, name: user.name });
});

// ---- generic CRUD helpers ----

function crud(model: keyof typeof prisma, options?: { orderBy?: object }) {
  const r = Router();
  const db = prisma[model] as any;

  r.get('/', requireAdmin, async (_req, res) => {
    const items = await db.findMany({ orderBy: options?.orderBy || { createdAt: 'desc' } });
    return ok(res, items);
  });

  r.get('/:id', requireAdmin, async (req, res) => {
    const item = await db.findUnique({ where: { id: req.params.id } });
    if (!item) return fail(res, 'Not found', 404);
    return ok(res, item);
  });

  r.post('/', requireAdmin, async (req, res) => {
    try {
      const item = await db.create({ data: req.body });
      return ok(res, item, 201);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
  });

  r.put('/:id', requireAdmin, async (req, res) => {
    try {
      const item = await db.update({ where: { id: req.params.id }, data: req.body });
      return ok(res, item);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
  });

  r.delete('/:id', requireAdmin, async (req, res) => {
    try {
      await db.delete({ where: { id: req.params.id } });
      return ok(res, { deleted: true });
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Delete failed', 400);
    }
  });

  return r;
}

router.use('/services', (() => {
  const r = Router();
  r.get('/', requireAdmin, async (_req, res) => {
    const items = await prisma.service.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { packages: true, addons: true, requirementSchema: true },
    });
    return ok(res, items);
  });
  r.get('/:id', requireAdmin, async (req, res) => {
    const item = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: { packages: true, addons: true, requirementSchema: true },
    });
    if (!item) return fail(res, 'Not found', 404);
    return ok(res, item);
  });
  r.post('/', requireAdmin, async (req, res) => {
    try {
      const { packages, addons, requirementSchema, deliverables, ...rest } = req.body;
      const item = await prisma.service.create({
        data: {
          ...rest,
          deliverables:
            typeof deliverables === 'string' ? deliverables : JSON.stringify(deliverables || []),
        },
      });

      // Attach default FormDefinition v2 so new services are immediately orderable
      const defaultSchema =
        requirementSchema && typeof requirementSchema === 'object'
          ? requirementSchema
          : {
              version: 2,
              stepLabels: ['تفاصيل المشروع', 'الملفات والمتطلبات'],
              sections: [
                {
                  id: 'project',
                  step: '01',
                  icon: '📋',
                  title: 'تفاصيل ومتطلبات الخدمة',
                  desc: 'يرجى تزويدنا بكافة المعلومات المتعلقة بطلبك',
                  fields: [
                    {
                      id: 'projectTitle',
                      type: 'text',
                      label: 'اسم المشروع / العلامة التجارية',
                      outputKey: 'اسم المشروع',
                      required: true,
                    },
                    {
                      id: 'projectDetails',
                      type: 'textarea',
                      label: 'شرح وتفاصيل المتطلبات',
                      outputKey: 'تفاصيل الطلب',
                      required: true,
                      rows: 4,
                    },
                    {
                      id: 'attachedFiles',
                      type: 'file',
                      label: 'الملفات والمستندات المرفقة',
                      outputKey: 'الملفات المرفقة',
                      multiple: true,
                    },
                  ],
                },
              ],
            };

      await prisma.serviceRequirementSchema.create({
        data: {
          serviceId: item.id,
          schemaJson: JSON.stringify(defaultSchema),
          version: 2,
        },
      });

      return ok(res, item, 201);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
  });
  r.put('/:id', requireAdmin, async (req, res) => {
    try {
      const { packages, addons, requirementSchema, deliverables, ...rest } = req.body;
      const data: Record<string, unknown> = { ...rest };
      if (deliverables !== undefined) {
        data.deliverables =
          typeof deliverables === 'string' ? deliverables : JSON.stringify(deliverables);
      }
      const item = await prisma.service.update({ where: { id: req.params.id }, data });
      return ok(res, item);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
  });
  r.delete('/:id', requireAdmin, async (req, res) => {
    await prisma.service.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  });
  return r;
})());

router.use('/packages', (() => {
  const r = Router();
  r.get('/', requireAdmin, async (req, res) => {
    const where = req.query.serviceId ? { serviceId: String(req.query.serviceId) } : {};
    return ok(res, await prisma.servicePackage.findMany({ where, orderBy: { sortOrder: 'asc' } }));
  });
  r.post('/', requireAdmin, async (req, res) => {
    try {
      return ok(res, await prisma.servicePackage.create({ data: req.body }), 201);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
  });
  r.put('/:id', requireAdmin, async (req, res) => {
    try {
      return ok(res, await prisma.servicePackage.update({ where: { id: req.params.id }, data: req.body }));
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
  });
  r.delete('/:id', requireAdmin, async (req, res) => {
    await prisma.servicePackage.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  });
  return r;
})());

router.use('/addons', (() => {
  const r = Router();
  r.get('/', requireAdmin, async (req, res) => {
    const where = req.query.serviceId ? { serviceId: String(req.query.serviceId) } : {};
    return ok(res, await prisma.serviceAddon.findMany({ where, orderBy: { sortOrder: 'asc' } }));
  });
  r.post('/', requireAdmin, async (req, res) => {
    try {
      return ok(res, await prisma.serviceAddon.create({ data: req.body }), 201);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
  });
  r.put('/:id', requireAdmin, async (req, res) => {
    try {
      return ok(res, await prisma.serviceAddon.update({ where: { id: req.params.id }, data: req.body }));
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
  });
  r.delete('/:id', requireAdmin, async (req, res) => {
    await prisma.serviceAddon.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  });
  return r;
})());

router.put('/requirement-schemas/:serviceId', requireAdmin, async (req, res) => {
  try {
    const schemaJson =
      typeof req.body.schemaJson === 'string'
        ? req.body.schemaJson
        : JSON.stringify(req.body.schema || req.body);
    const item = await prisma.serviceRequirementSchema.upsert({
      where: { serviceId: req.params.serviceId },
      create: { serviceId: req.params.serviceId, schemaJson, version: 1 },
      update: { schemaJson, version: { increment: 1 } },
    });
    return ok(res, item);
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
  }
});

router.use('/bundles', crud('bundle', { orderBy: { sortOrder: 'asc' } }));
router.use('/coupons', crud('coupon', { orderBy: { createdAt: 'desc' } }));
router.use('/hero-slides', crud('heroSlide', { orderBy: { sortOrder: 'asc' } }));
router.use('/portfolio', (() => {
  const r = Router();
  r.get('/', requireAdmin, async (_req, res) => {
    const items = await prisma.portfolioItem.findMany({ orderBy: { sortOrder: 'asc' } });
    return ok(res, items);
  });
  r.post('/', requireAdmin, async (req, res) => {
    const { features, ...rest } = req.body;
    const item = await prisma.portfolioItem.create({
      data: {
        ...rest,
        features: typeof features === 'string' ? features : JSON.stringify(features || []),
      },
    });
    return ok(res, item, 201);
  });
  r.put('/:id', requireAdmin, async (req, res) => {
    const { features, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    if (features !== undefined) {
      data.features = typeof features === 'string' ? features : JSON.stringify(features);
    }
    const item = await prisma.portfolioItem.update({ where: { id: req.params.id }, data });
    return ok(res, item);
  });
  r.delete('/:id', requireAdmin, async (req, res) => {
    await prisma.portfolioItem.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  });
  return r;
})());
router.use('/testimonials', crud('testimonial', { orderBy: { sortOrder: 'asc' } }));
router.use('/faqs', crud('faq', { orderBy: { sortOrder: 'asc' } }));
router.use('/currencies', crud('currency', { orderBy: { code: 'asc' } }));

router.get('/calculator', requireAdmin, async (_req, res) => {
  const calc = await prisma.calculatorConfig.findUnique({ where: { id: 'default' } });
  return ok(res, calc);
});

router.put('/calculator', requireAdmin, async (req, res) => {
  const calc = await prisma.calculatorConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...req.body },
    update: req.body,
  });
  return ok(res, calc);
});

router.get('/site-settings', requireAdmin, async (_req, res) => {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
  return ok(res, settings);
});

router.put('/site-settings', requireAdmin, async (req, res) => {
  try {
    const { paymentBadges, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    if (paymentBadges !== undefined) {
      data.paymentBadges =
        typeof paymentBadges === 'string' ? paymentBadges : JSON.stringify(paymentBadges);
    }
    const existing = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
    if (existing) {
      const settings = await prisma.siteSettings.update({
        where: { id: 'default' },
        data,
      });
      return ok(res, settings);
    }
    const settings = await prisma.siteSettings.create({
      data: {
        id: 'default',
        siteTitle: String(data.siteTitle || 'كوبالت'),
        siteDescription: String(data.siteDescription || ''),
        whatsappNumber: String(data.whatsappNumber || ''),
        logoUrl: String(data.logoUrl || ''),
        instagramUrl: String(data.instagramUrl || ''),
        twitterUrl: String(data.twitterUrl || ''),
        tiktokUrl: String(data.tiktokUrl || ''),
        copyrightText: String(data.copyrightText || ''),
        paymentBadges: String(data.paymentBadges || '[]'),
        footerDesc: String(data.footerDesc || ''),
        supportBlurb: String(data.supportBlurb || ''),
      },
    });
    return ok(res, settings);
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
  }
});

router.get('/orders', requireAdmin, async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  return ok(res, orders);
});

router.get('/orders/:id', requireAdmin, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!order) return fail(res, 'Not found', 404);
  return ok(res, order);
});

router.patch('/orders/:id', requireAdmin, async (req, res) => {
  const { status, paymentStatus } = req.body || {};
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
    },
    include: { items: true },
  });
  return ok(res, order);
});

router.get('/dashboard', requireAdmin, async (_req, res) => {
  const [orders, services, coupons] = await Promise.all([
    prisma.order.count(),
    prisma.service.count({ where: { active: true } }),
    prisma.coupon.count({ where: { active: true } }),
  ]);
  const recent = await prisma.order.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  const revenue = await prisma.order.aggregate({ _sum: { totalSAR: true } });
  return ok(res, {
    counts: { orders, services, coupons },
    revenueSAR: revenue._sum.totalSAR || 0,
    recentOrders: recent,
  });
});

export default router;
