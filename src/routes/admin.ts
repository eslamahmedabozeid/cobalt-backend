import { Router } from 'express';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { ok, fail } from '../utils/response';
import { requireAdmin, requirePermission, serializeAdmin, AuthRequest } from '../middleware/auth';
import { RESOURCES, SUPER_ADMIN_SLUG, RESERVED_ROLE_SLUGS, hasPermission, sanitizePermissions } from '../lib/permissions';
import { absoluteOrderFilePath } from '../lib/orderFiles';

const router = Router();

function publicAdmin(admin: ReturnType<typeof serializeAdmin>) {
  return admin;
}

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 'Email and password required', 400);
  const user = await prisma.adminUser.findUnique({
    where: { email: String(email).toLowerCase() },
    include: { role: true },
  });
  if (!user || !user.active) return fail(res, 'Invalid credentials', 401, undefined, 'UNAUTHORIZED');
  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) return fail(res, 'Invalid credentials', 401, undefined, 'UNAUTHORIZED');
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') } as jwt.SignOptions
  );
  return ok(res, {
    token,
    admin: publicAdmin(serializeAdmin(user)),
  });
});

router.post('/auth/logout', requireAdmin, (_req, res) => ok(res, { loggedOut: true }));

router.get('/me', requireAdmin, async (req: AuthRequest, res) => {
  return ok(res, publicAdmin(req.admin!));
});

router.get('/permission-catalog', requireAdmin, requirePermission('roles', 'read'), (_req, res) => {
  return ok(res, { resources: RESOURCES });
});

// ---- generic CRUD helpers ----

function crud(model: keyof typeof prisma, options: { orderBy?: object; resource: string }) {
  const r = Router();
  const db = prisma[model] as any;
  const resource = options.resource;

  r.get('/', requireAdmin, requirePermission(resource, 'read'), async (_req, res) => {
    const items = await db.findMany({ orderBy: options.orderBy || { createdAt: 'desc' } });
    return ok(res, items);
  });

  r.get('/:id', requireAdmin, requirePermission(resource, 'read'), async (req, res) => {
    const item = await db.findUnique({ where: { id: req.params.id } });
    if (!item) return fail(res, 'Not found', 404);
    return ok(res, item);
  });

  r.post('/', requireAdmin, requirePermission(resource, 'create'), async (req, res) => {
    try {
      const item = await db.create({ data: req.body });
      return ok(res, item, 201);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
  });

  r.put('/:id', requireAdmin, requirePermission(resource, 'update'), async (req, res) => {
    try {
      const item = await db.update({ where: { id: req.params.id }, data: req.body });
      return ok(res, item);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
  });

  r.delete('/:id', requireAdmin, requirePermission(resource, 'delete'), async (req, res) => {
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
  r.get('/', requireAdmin, requirePermission('services', 'read'), async (_req, res) => {
    const items = await prisma.service.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { packages: true, addons: true, requirementSchema: true },
    });
    return ok(res, items);
  });
  r.get('/:id', requireAdmin, requirePermission('services', 'read'), async (req, res) => {
    const item = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: { packages: true, addons: true, requirementSchema: true },
    });
    if (!item) return fail(res, 'Not found', 404);
    return ok(res, item);
  });
  r.post('/', requireAdmin, requirePermission('services', 'create'), async (req, res) => {
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
  r.put('/:id', requireAdmin, requirePermission('services', 'update'), async (req, res) => {
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
  r.delete('/:id', requireAdmin, requirePermission('services', 'delete'), async (req, res) => {
    await prisma.service.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  });
  return r;
})());

router.use('/packages', (() => {
  const r = Router();
  r.get('/', requireAdmin, requirePermission('services', 'read'), async (req, res) => {
    const where = req.query.serviceId ? { serviceId: String(req.query.serviceId) } : {};
    return ok(res, await prisma.servicePackage.findMany({ where, orderBy: { sortOrder: 'asc' } }));
  });
  r.post('/', requireAdmin, requirePermission('services', 'update'), async (req, res) => {
    try {
      return ok(res, await prisma.servicePackage.create({ data: req.body }), 201);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
  });
  r.put('/:id', requireAdmin, requirePermission('services', 'update'), async (req, res) => {
    try {
      return ok(res, await prisma.servicePackage.update({ where: { id: req.params.id }, data: req.body }));
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
  });
  r.delete('/:id', requireAdmin, requirePermission('services', 'update'), async (req, res) => {
    await prisma.servicePackage.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  });
  return r;
})());

router.use('/addons', (() => {
  const r = Router();
  r.get('/', requireAdmin, requirePermission('services', 'read'), async (req, res) => {
    const where = req.query.serviceId ? { serviceId: String(req.query.serviceId) } : {};
    return ok(res, await prisma.serviceAddon.findMany({ where, orderBy: { sortOrder: 'asc' } }));
  });
  r.post('/', requireAdmin, requirePermission('services', 'update'), async (req, res) => {
    try {
      return ok(res, await prisma.serviceAddon.create({ data: req.body }), 201);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
  });
  r.put('/:id', requireAdmin, requirePermission('services', 'update'), async (req, res) => {
    try {
      return ok(res, await prisma.serviceAddon.update({ where: { id: req.params.id }, data: req.body }));
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
  });
  r.delete('/:id', requireAdmin, requirePermission('services', 'update'), async (req, res) => {
    await prisma.serviceAddon.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  });
  return r;
})());

router.put('/requirement-schemas/:serviceId', requireAdmin, requirePermission('services', 'update'), async (req, res) => {
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

router.use('/bundles', crud('bundle', { orderBy: { sortOrder: 'asc' }, resource: 'bundles' }));
router.use('/coupons', crud('coupon', { orderBy: { createdAt: 'desc' }, resource: 'coupons' }));
router.use('/hero-slides', crud('heroSlide', { orderBy: { sortOrder: 'asc' }, resource: 'hero-slides' }));
router.use('/portfolio', (() => {
  const r = Router();
  r.get('/', requireAdmin, requirePermission('portfolio', 'read'), async (_req, res) => {
    const items = await prisma.portfolioItem.findMany({ orderBy: { sortOrder: 'asc' } });
    return ok(res, items);
  });
  r.post('/', requireAdmin, requirePermission('portfolio', 'create'), async (req, res) => {
    const { features, ...rest } = req.body;
    const item = await prisma.portfolioItem.create({
      data: {
        ...rest,
        features: typeof features === 'string' ? features : JSON.stringify(features || []),
      },
    });
    return ok(res, item, 201);
  });
  r.put('/:id', requireAdmin, requirePermission('portfolio', 'update'), async (req, res) => {
    const { features, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    if (features !== undefined) {
      data.features = typeof features === 'string' ? features : JSON.stringify(features);
    }
    const item = await prisma.portfolioItem.update({ where: { id: req.params.id }, data });
    return ok(res, item);
  });
  r.delete('/:id', requireAdmin, requirePermission('portfolio', 'delete'), async (req, res) => {
    await prisma.portfolioItem.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  });
  return r;
})());
router.use('/testimonials', crud('testimonial', { orderBy: { sortOrder: 'asc' }, resource: 'testimonials' }));
router.use('/faqs', crud('faq', { orderBy: { sortOrder: 'asc' }, resource: 'faqs' }));
router.use('/currencies', crud('currency', { orderBy: { code: 'asc' }, resource: 'currencies' }));

router.get('/calculator', requireAdmin, requirePermission('calculator', 'read'), async (_req, res) => {
  const calc = await prisma.calculatorConfig.findUnique({ where: { id: 'default' } });
  return ok(res, calc);
});

router.put('/calculator', requireAdmin, requirePermission('calculator', 'update'), async (req, res) => {
  const calc = await prisma.calculatorConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...req.body },
    update: req.body,
  });
  return ok(res, calc);
});

router.get('/site-settings', requireAdmin, requirePermission('settings', 'read'), async (_req, res) => {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
  return ok(res, settings);
});

router.put('/site-settings', requireAdmin, requirePermission('settings', 'update'), async (req, res) => {
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

router.get('/orders', requireAdmin, requirePermission('orders', 'read'), async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true, files: true },
  });
  return ok(res, orders);
});

router.get('/orders/:id', requireAdmin, requirePermission('orders', 'read'), async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true, files: true },
  });
  if (!order) return fail(res, 'Not found', 404);
  return ok(res, order);
});

router.get(
  '/orders/:orderId/files/:fileId/download',
  requireAdmin,
  requirePermission('orders', 'read'),
  async (req, res) => {
    const file = await prisma.orderFile.findFirst({
      where: { id: req.params.fileId, orderId: req.params.orderId },
    });
    if (!file) return fail(res, 'File not found', 404);

    const abs = absoluteOrderFilePath(file.storedName);
    if (!fs.existsSync(abs)) return fail(res, 'File missing on disk', 404);

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`
    );
    return res.sendFile(abs);
  }
);

router.patch('/orders/:id', requireAdmin, requirePermission('orders', 'update'), async (req, res) => {
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

router.get('/dashboard', requireAdmin, requirePermission('dashboard', 'read'), async (_req, res) => {
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

function rolePublic(role: { id: string; slug: string; name: string; description: string; isSystem: boolean; permissions: string; createdAt: Date; updatedAt: Date; _count?: { users: number } }) {
  let permissions: '*' | Record<string, unknown> = {};
  if (role.permissions === '*') {
    permissions = '*';
  } else {
    try {
      permissions = JSON.parse(role.permissions || '{}');
    } catch {
      permissions = {};
    }
  }
  return {
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions,
    usersCount: role._count?.users ?? undefined,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

function normalizeRoleSlug(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function countSuperAdmins(): Promise<number> {
  return prisma.adminUser.count({
    where: { active: true, role: { slug: SUPER_ADMIN_SLUG } },
  });
}

router.get('/roles', requireAdmin, (req: AuthRequest, res, next) => {
  const admin = req.admin!;
  const allowed =
    admin.isSuperAdmin ||
    hasPermission(admin.permissions, 'roles', 'read', admin.isSuperAdmin) ||
    hasPermission(admin.permissions, 'users', 'read', admin.isSuperAdmin);
  if (!allowed) return fail(res, 'ليس لديك صلاحية لتنفيذ هذا الإجراء', 403, undefined, 'FORBIDDEN');
  next();
}, async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { users: true } } },
  });
  return ok(res, roles.map(rolePublic));
});

router.post('/roles', requireAdmin, requirePermission('roles', 'create'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return fail(res, 'اسم الدور مطلوب', 400);
    const slug = normalizeRoleSlug(req.body.slug || name);
    if (!slug) return fail(res, 'معرف الدور غير صالح', 400);
    if (RESERVED_ROLE_SLUGS.has(slug)) {
      return fail(res, 'هذا المعرف محجوز لأدوار النظام', 400);
    }
    const role = await prisma.role.create({
      data: {
        name,
        slug,
        description: String(req.body.description || ''),
        isSystem: false,
        permissions: sanitizePermissions(req.body.permissions),
      },
    });
    return ok(res, rolePublic(role), 201);
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
  }
});

router.put('/roles/:id', requireAdmin, requirePermission('roles', 'update'), async (req, res) => {
  try {
    const existing = await prisma.role.findUnique({ where: { id: req.params.id } });
    if (!existing) return fail(res, 'Not found', 404);
    const data: Record<string, unknown> = {};
    if (req.body.name != null) data.name = String(req.body.name).trim();
    if (req.body.description != null) data.description = String(req.body.description);
    if (req.body.permissions != null) {
      data.permissions = existing.slug === SUPER_ADMIN_SLUG ? '*' : sanitizePermissions(req.body.permissions);
    }
    if (req.body.slug != null && !existing.isSystem) {
      const slug = normalizeRoleSlug(req.body.slug);
      if (!slug) return fail(res, 'معرف الدور غير صالح', 400);
      if (RESERVED_ROLE_SLUGS.has(slug)) {
        return fail(res, 'هذا المعرف محجوز لأدوار النظام', 400);
      }
      data.slug = slug;
    }
    const role = await prisma.role.update({ where: { id: req.params.id }, data });
    return ok(res, rolePublic(role));
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
  }
});

router.delete('/roles/:id', requireAdmin, requirePermission('roles', 'delete'), async (req, res) => {
  const existing = await prisma.role.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) return fail(res, 'Not found', 404);
  if (existing.isSystem) return fail(res, 'لا يمكن حذف دور نظام أساسي', 400);
  if (existing._count.users > 0) {
    return fail(res, 'لا يمكن حذف دور مرتبط بمستخدمين. أعد تعيينهم أولاً', 400);
  }
  await prisma.role.delete({ where: { id: req.params.id } });
  return ok(res, { deleted: true });
});

function userPublic(user: {
  id: string;
  email: string;
  name: string;
  active: boolean;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  role: { id: string; slug: string; name: string };
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    roleId: user.roleId,
    roleSlug: user.role.slug,
    roleName: user.role.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

router.get('/users', requireAdmin, requirePermission('users', 'read'), async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    include: { role: true },
  });
  return ok(res, users.map(userPublic));
});

router.post('/users', requireAdmin, requirePermission('users', 'create'), async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');
    const roleId = String(req.body.roleId || '');
    if (!email || !name || !password || !roleId) {
      return fail(res, 'الاسم والبريد وكلمة المرور والدور مطلوبة', 400);
    }
    if (password.length < 8) return fail(res, 'كلمة المرور يجب ألا تقل عن 8 أحرف', 400);
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return fail(res, 'الدور غير موجود', 400);
    const user = await prisma.adminUser.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 10),
        roleId,
        active: req.body.active !== false,
      },
      include: { role: true },
    });
    return ok(res, userPublic(user), 201);
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
  }
});

router.put('/users/:id', requireAdmin, requirePermission('users', 'update'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.adminUser.findUnique({
      where: { id: req.params.id },
      include: { role: true },
    });
    if (!existing) return fail(res, 'Not found', 404);
    const data: Record<string, unknown> = {};
    if (req.body.name != null) data.name = String(req.body.name).trim();
    if (req.body.email != null) data.email = String(req.body.email).trim().toLowerCase();
    if (req.body.active != null) {
      if (req.params.id === req.admin!.id && req.body.active === false) {
        return fail(res, 'لا يمكنك تعطيل حسابك الحالي', 400);
      }
      if (
        existing.role.slug === SUPER_ADMIN_SLUG &&
        existing.active &&
        req.body.active === false &&
        (await countSuperAdmins()) <= 1
      ) {
        return fail(res, 'لا يمكن تعطيل آخر مدير نظام نشط', 400);
      }
      data.active = Boolean(req.body.active);
    }
    if (req.body.roleId != null) {
      const role = await prisma.role.findUnique({ where: { id: String(req.body.roleId) } });
      if (!role) return fail(res, 'الدور غير موجود', 400);
      if (
        existing.role.slug === SUPER_ADMIN_SLUG &&
        role.slug !== SUPER_ADMIN_SLUG &&
        existing.active &&
        (await countSuperAdmins()) <= 1
      ) {
        return fail(res, 'لا يمكن تغيير دور آخر مدير نظام نشط', 400);
      }
      data.roleId = role.id;
    }
    if (req.body.password) {
      if (String(req.body.password).length < 8) {
        return fail(res, 'كلمة المرور يجب ألا تقل عن 8 أحرف', 400);
      }
      data.passwordHash = await bcrypt.hash(String(req.body.password), 10);
    }
    const user = await prisma.adminUser.update({
      where: { id: req.params.id },
      data,
      include: { role: true },
    });
    return ok(res, userPublic(user));
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
  }
});

router.delete('/users/:id', requireAdmin, requirePermission('users', 'delete'), async (req: AuthRequest, res) => {
  if (req.params.id === req.admin!.id) {
    return fail(res, 'لا يمكنك حذف حسابك الحالي', 400);
  }
  const existing = await prisma.adminUser.findUnique({
    where: { id: req.params.id },
    include: { role: true },
  });
  if (!existing) return fail(res, 'Not found', 404);
  if (
    existing.role.slug === SUPER_ADMIN_SLUG &&
    existing.active &&
    (await countSuperAdmins()) <= 1
  ) {
    return fail(res, 'لا يمكن حذف آخر مدير نظام نشط', 400);
  }
  await prisma.adminUser.delete({ where: { id: req.params.id } });
  return ok(res, { deleted: true });
});

export default router;
