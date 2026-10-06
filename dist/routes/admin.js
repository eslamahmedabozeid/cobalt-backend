"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const response_1 = require("../utils/response");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../lib/permissions");
const orderFiles_1 = require("../lib/orderFiles");
const router = (0, express_1.Router)();
function publicAdmin(admin) {
    return admin;
}
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
        return (0, response_1.fail)(res, 'Email and password required', 400);
    const user = await prisma_1.prisma.adminUser.findUnique({
        where: { email: String(email).toLowerCase() },
        include: { role: true },
    });
    if (!user || !user.active)
        return (0, response_1.fail)(res, 'Invalid credentials', 401, undefined, 'UNAUTHORIZED');
    const valid = await bcryptjs_1.default.compare(String(password), user.passwordHash);
    if (!valid)
        return (0, response_1.fail)(res, 'Invalid credentials', 401, undefined, 'UNAUTHORIZED');
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') });
    return (0, response_1.ok)(res, {
        token,
        admin: publicAdmin((0, auth_1.serializeAdmin)(user)),
    });
});
router.post('/auth/logout', auth_1.requireAdmin, (_req, res) => (0, response_1.ok)(res, { loggedOut: true }));
router.get('/me', auth_1.requireAdmin, async (req, res) => {
    return (0, response_1.ok)(res, publicAdmin(req.admin));
});
router.get('/permission-catalog', auth_1.requireAdmin, (0, auth_1.requirePermission)('roles', 'read'), (_req, res) => {
    return (0, response_1.ok)(res, { resources: permissions_1.RESOURCES });
});
// ---- generic CRUD helpers ----
function crud(model, options) {
    const r = (0, express_1.Router)();
    const db = prisma_1.prisma[model];
    const resource = options.resource;
    r.get('/', auth_1.requireAdmin, (0, auth_1.requirePermission)(resource, 'read'), async (_req, res) => {
        const items = await db.findMany({ orderBy: options.orderBy || { createdAt: 'desc' } });
        return (0, response_1.ok)(res, items);
    });
    r.get('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)(resource, 'read'), async (req, res) => {
        const item = await db.findUnique({ where: { id: req.params.id } });
        if (!item)
            return (0, response_1.fail)(res, 'Not found', 404);
        return (0, response_1.ok)(res, item);
    });
    r.post('/', auth_1.requireAdmin, (0, auth_1.requirePermission)(resource, 'create'), async (req, res) => {
        try {
            const item = await db.create({ data: req.body });
            return (0, response_1.ok)(res, item, 201);
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
        }
    });
    r.put('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)(resource, 'update'), async (req, res) => {
        try {
            const item = await db.update({ where: { id: req.params.id }, data: req.body });
            return (0, response_1.ok)(res, item);
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
        }
    });
    r.delete('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)(resource, 'delete'), async (req, res) => {
        try {
            await db.delete({ where: { id: req.params.id } });
            return (0, response_1.ok)(res, { deleted: true });
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Delete failed', 400);
        }
    });
    return r;
}
router.use('/services', (() => {
    const r = (0, express_1.Router)();
    r.get('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'read'), async (_req, res) => {
        const items = await prisma_1.prisma.service.findMany({
            orderBy: { sortOrder: 'asc' },
            include: { packages: true, addons: true, requirementSchema: true },
        });
        return (0, response_1.ok)(res, items);
    });
    r.get('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'read'), async (req, res) => {
        const item = await prisma_1.prisma.service.findUnique({
            where: { id: req.params.id },
            include: { packages: true, addons: true, requirementSchema: true },
        });
        if (!item)
            return (0, response_1.fail)(res, 'Not found', 404);
        return (0, response_1.ok)(res, item);
    });
    r.post('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'create'), async (req, res) => {
        try {
            const { packages, addons, requirementSchema, deliverables, ...rest } = req.body;
            const item = await prisma_1.prisma.service.create({
                data: {
                    ...rest,
                    deliverables: typeof deliverables === 'string' ? deliverables : JSON.stringify(deliverables || []),
                },
            });
            // Attach default FormDefinition v2 so new services are immediately orderable
            const defaultSchema = requirementSchema && typeof requirementSchema === 'object'
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
            await prisma_1.prisma.serviceRequirementSchema.create({
                data: {
                    serviceId: item.id,
                    schemaJson: JSON.stringify(defaultSchema),
                    version: 2,
                },
            });
            return (0, response_1.ok)(res, item, 201);
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
        }
    });
    r.put('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'update'), async (req, res) => {
        try {
            const { packages, addons, requirementSchema, deliverables, ...rest } = req.body;
            const data = { ...rest };
            if (deliverables !== undefined) {
                data.deliverables =
                    typeof deliverables === 'string' ? deliverables : JSON.stringify(deliverables);
            }
            const item = await prisma_1.prisma.service.update({ where: { id: req.params.id }, data });
            return (0, response_1.ok)(res, item);
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
        }
    });
    r.delete('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'delete'), async (req, res) => {
        await prisma_1.prisma.service.delete({ where: { id: req.params.id } });
        return (0, response_1.ok)(res, { deleted: true });
    });
    return r;
})());
router.use('/packages', (() => {
    const r = (0, express_1.Router)();
    r.get('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'read'), async (req, res) => {
        const where = req.query.serviceId ? { serviceId: String(req.query.serviceId) } : {};
        return (0, response_1.ok)(res, await prisma_1.prisma.servicePackage.findMany({ where, orderBy: { sortOrder: 'asc' } }));
    });
    r.post('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'update'), async (req, res) => {
        try {
            return (0, response_1.ok)(res, await prisma_1.prisma.servicePackage.create({ data: req.body }), 201);
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
        }
    });
    r.put('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'update'), async (req, res) => {
        try {
            return (0, response_1.ok)(res, await prisma_1.prisma.servicePackage.update({ where: { id: req.params.id }, data: req.body }));
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
        }
    });
    r.delete('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'update'), async (req, res) => {
        await prisma_1.prisma.servicePackage.delete({ where: { id: req.params.id } });
        return (0, response_1.ok)(res, { deleted: true });
    });
    return r;
})());
router.use('/addons', (() => {
    const r = (0, express_1.Router)();
    r.get('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'read'), async (req, res) => {
        const where = req.query.serviceId ? { serviceId: String(req.query.serviceId) } : {};
        return (0, response_1.ok)(res, await prisma_1.prisma.serviceAddon.findMany({ where, orderBy: { sortOrder: 'asc' } }));
    });
    r.post('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'update'), async (req, res) => {
        try {
            return (0, response_1.ok)(res, await prisma_1.prisma.serviceAddon.create({ data: req.body }), 201);
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
        }
    });
    r.put('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'update'), async (req, res) => {
        try {
            return (0, response_1.ok)(res, await prisma_1.prisma.serviceAddon.update({ where: { id: req.params.id }, data: req.body }));
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
        }
    });
    r.delete('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'update'), async (req, res) => {
        await prisma_1.prisma.serviceAddon.delete({ where: { id: req.params.id } });
        return (0, response_1.ok)(res, { deleted: true });
    });
    return r;
})());
router.put('/requirement-schemas/:serviceId', auth_1.requireAdmin, (0, auth_1.requirePermission)('services', 'update'), async (req, res) => {
    try {
        const schemaJson = typeof req.body.schemaJson === 'string'
            ? req.body.schemaJson
            : JSON.stringify(req.body.schema || req.body);
        const item = await prisma_1.prisma.serviceRequirementSchema.upsert({
            where: { serviceId: req.params.serviceId },
            create: { serviceId: req.params.serviceId, schemaJson, version: 1 },
            update: { schemaJson, version: { increment: 1 } },
        });
        return (0, response_1.ok)(res, item);
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
});
router.use('/bundles', crud('bundle', { orderBy: { sortOrder: 'asc' }, resource: 'bundles' }));
router.use('/coupons', crud('coupon', { orderBy: { createdAt: 'desc' }, resource: 'coupons' }));
router.use('/hero-slides', crud('heroSlide', { orderBy: { sortOrder: 'asc' }, resource: 'hero-slides' }));
router.use('/portfolio', (() => {
    const r = (0, express_1.Router)();
    r.get('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('portfolio', 'read'), async (_req, res) => {
        const items = await prisma_1.prisma.portfolioItem.findMany({ orderBy: { sortOrder: 'asc' } });
        return (0, response_1.ok)(res, items);
    });
    r.post('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('portfolio', 'create'), async (req, res) => {
        const { features, ...rest } = req.body;
        const item = await prisma_1.prisma.portfolioItem.create({
            data: {
                ...rest,
                features: typeof features === 'string' ? features : JSON.stringify(features || []),
            },
        });
        return (0, response_1.ok)(res, item, 201);
    });
    r.put('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('portfolio', 'update'), async (req, res) => {
        const { features, ...rest } = req.body;
        const data = { ...rest };
        if (features !== undefined) {
            data.features = typeof features === 'string' ? features : JSON.stringify(features);
        }
        const item = await prisma_1.prisma.portfolioItem.update({ where: { id: req.params.id }, data });
        return (0, response_1.ok)(res, item);
    });
    r.delete('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('portfolio', 'delete'), async (req, res) => {
        await prisma_1.prisma.portfolioItem.delete({ where: { id: req.params.id } });
        return (0, response_1.ok)(res, { deleted: true });
    });
    return r;
})());
router.use('/testimonials', crud('testimonial', { orderBy: { sortOrder: 'asc' }, resource: 'testimonials' }));
router.use('/faqs', crud('faq', { orderBy: { sortOrder: 'asc' }, resource: 'faqs' }));
router.use('/currencies', crud('currency', { orderBy: { code: 'asc' }, resource: 'currencies' }));
router.get('/calculator', auth_1.requireAdmin, (0, auth_1.requirePermission)('calculator', 'read'), async (_req, res) => {
    const calc = await prisma_1.prisma.calculatorConfig.findUnique({ where: { id: 'default' } });
    return (0, response_1.ok)(res, calc);
});
router.put('/calculator', auth_1.requireAdmin, (0, auth_1.requirePermission)('calculator', 'update'), async (req, res) => {
    const calc = await prisma_1.prisma.calculatorConfig.upsert({
        where: { id: 'default' },
        create: { id: 'default', ...req.body },
        update: req.body,
    });
    return (0, response_1.ok)(res, calc);
});
router.get('/site-settings', auth_1.requireAdmin, (0, auth_1.requirePermission)('settings', 'read'), async (_req, res) => {
    const settings = await prisma_1.prisma.siteSettings.findUnique({ where: { id: 'default' } });
    return (0, response_1.ok)(res, settings);
});
router.put('/site-settings', auth_1.requireAdmin, (0, auth_1.requirePermission)('settings', 'update'), async (req, res) => {
    try {
        const { paymentBadges, ...rest } = req.body;
        const data = { ...rest };
        if (paymentBadges !== undefined) {
            data.paymentBadges =
                typeof paymentBadges === 'string' ? paymentBadges : JSON.stringify(paymentBadges);
        }
        const existing = await prisma_1.prisma.siteSettings.findUnique({ where: { id: 'default' } });
        if (existing) {
            const settings = await prisma_1.prisma.siteSettings.update({
                where: { id: 'default' },
                data,
            });
            return (0, response_1.ok)(res, settings);
        }
        const settings = await prisma_1.prisma.siteSettings.create({
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
        return (0, response_1.ok)(res, settings);
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
});
router.get('/orders', auth_1.requireAdmin, (0, auth_1.requirePermission)('orders', 'read'), async (_req, res) => {
    const orders = await prisma_1.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: { items: true, files: true },
    });
    return (0, response_1.ok)(res, orders);
});
router.get('/orders/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('orders', 'read'), async (req, res) => {
    const order = await prisma_1.prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true, files: true },
    });
    if (!order)
        return (0, response_1.fail)(res, 'Not found', 404);
    return (0, response_1.ok)(res, order);
});
router.get('/orders/:orderId/files/:fileId/download', auth_1.requireAdmin, (0, auth_1.requirePermission)('orders', 'read'), async (req, res) => {
    const file = await prisma_1.prisma.orderFile.findFirst({
        where: { id: req.params.fileId, orderId: req.params.orderId },
    });
    if (!file)
        return (0, response_1.fail)(res, 'File not found', 404);
    const abs = (0, orderFiles_1.absoluteOrderFilePath)(file.storedName);
    if (!fs_1.default.existsSync(abs))
        return (0, response_1.fail)(res, 'File missing on disk', 404);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    return res.sendFile(abs);
});
router.patch('/orders/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('orders', 'update'), async (req, res) => {
    const { status, paymentStatus } = req.body || {};
    const order = await prisma_1.prisma.order.update({
        where: { id: req.params.id },
        data: {
            ...(status ? { status } : {}),
            ...(paymentStatus ? { paymentStatus } : {}),
        },
        include: { items: true },
    });
    return (0, response_1.ok)(res, order);
});
router.get('/dashboard', auth_1.requireAdmin, (0, auth_1.requirePermission)('dashboard', 'read'), async (_req, res) => {
    const [orders, services, coupons] = await Promise.all([
        prisma_1.prisma.order.count(),
        prisma_1.prisma.service.count({ where: { active: true } }),
        prisma_1.prisma.coupon.count({ where: { active: true } }),
    ]);
    const recent = await prisma_1.prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
    });
    const revenue = await prisma_1.prisma.order.aggregate({ _sum: { totalSAR: true } });
    return (0, response_1.ok)(res, {
        counts: { orders, services, coupons },
        revenueSAR: revenue._sum.totalSAR || 0,
        recentOrders: recent,
    });
});
function rolePublic(role) {
    let permissions = {};
    if (role.permissions === '*') {
        permissions = '*';
    }
    else {
        try {
            permissions = JSON.parse(role.permissions || '{}');
        }
        catch {
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
function normalizeRoleSlug(raw) {
    return String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/^-|-$/g, '');
}
async function countSuperAdmins() {
    return prisma_1.prisma.adminUser.count({
        where: { active: true, role: { slug: permissions_1.SUPER_ADMIN_SLUG } },
    });
}
router.get('/roles', auth_1.requireAdmin, (req, res, next) => {
    const admin = req.admin;
    const allowed = admin.isSuperAdmin ||
        (0, permissions_1.hasPermission)(admin.permissions, 'roles', 'read', admin.isSuperAdmin) ||
        (0, permissions_1.hasPermission)(admin.permissions, 'users', 'read', admin.isSuperAdmin);
    if (!allowed)
        return (0, response_1.fail)(res, 'ليس لديك صلاحية لتنفيذ هذا الإجراء', 403, undefined, 'FORBIDDEN');
    next();
}, async (_req, res) => {
    const roles = await prisma_1.prisma.role.findMany({
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { users: true } } },
    });
    return (0, response_1.ok)(res, roles.map(rolePublic));
});
router.post('/roles', auth_1.requireAdmin, (0, auth_1.requirePermission)('roles', 'create'), async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        if (!name)
            return (0, response_1.fail)(res, 'اسم الدور مطلوب', 400);
        const slug = normalizeRoleSlug(req.body.slug || name);
        if (!slug)
            return (0, response_1.fail)(res, 'معرف الدور غير صالح', 400);
        if (permissions_1.RESERVED_ROLE_SLUGS.has(slug)) {
            return (0, response_1.fail)(res, 'هذا المعرف محجوز لأدوار النظام', 400);
        }
        const role = await prisma_1.prisma.role.create({
            data: {
                name,
                slug,
                description: String(req.body.description || ''),
                isSystem: false,
                permissions: (0, permissions_1.sanitizePermissions)(req.body.permissions),
            },
        });
        return (0, response_1.ok)(res, rolePublic(role), 201);
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
});
router.put('/roles/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('roles', 'update'), async (req, res) => {
    try {
        const existing = await prisma_1.prisma.role.findUnique({ where: { id: req.params.id } });
        if (!existing)
            return (0, response_1.fail)(res, 'Not found', 404);
        const data = {};
        if (req.body.name != null)
            data.name = String(req.body.name).trim();
        if (req.body.description != null)
            data.description = String(req.body.description);
        if (req.body.permissions != null) {
            data.permissions = existing.slug === permissions_1.SUPER_ADMIN_SLUG ? '*' : (0, permissions_1.sanitizePermissions)(req.body.permissions);
        }
        if (req.body.slug != null && !existing.isSystem) {
            const slug = normalizeRoleSlug(req.body.slug);
            if (!slug)
                return (0, response_1.fail)(res, 'معرف الدور غير صالح', 400);
            if (permissions_1.RESERVED_ROLE_SLUGS.has(slug)) {
                return (0, response_1.fail)(res, 'هذا المعرف محجوز لأدوار النظام', 400);
            }
            data.slug = slug;
        }
        const role = await prisma_1.prisma.role.update({ where: { id: req.params.id }, data });
        return (0, response_1.ok)(res, rolePublic(role));
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
});
router.delete('/roles/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('roles', 'delete'), async (req, res) => {
    const existing = await prisma_1.prisma.role.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { users: true } } },
    });
    if (!existing)
        return (0, response_1.fail)(res, 'Not found', 404);
    if (existing.isSystem)
        return (0, response_1.fail)(res, 'لا يمكن حذف دور نظام أساسي', 400);
    if (existing._count.users > 0) {
        return (0, response_1.fail)(res, 'لا يمكن حذف دور مرتبط بمستخدمين. أعد تعيينهم أولاً', 400);
    }
    await prisma_1.prisma.role.delete({ where: { id: req.params.id } });
    return (0, response_1.ok)(res, { deleted: true });
});
function userPublic(user) {
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
router.get('/users', auth_1.requireAdmin, (0, auth_1.requirePermission)('users', 'read'), async (_req, res) => {
    const users = await prisma_1.prisma.adminUser.findMany({
        orderBy: { createdAt: 'asc' },
        include: { role: true },
    });
    return (0, response_1.ok)(res, users.map(userPublic));
});
router.post('/users', auth_1.requireAdmin, (0, auth_1.requirePermission)('users', 'create'), async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const name = String(req.body.name || '').trim();
        const password = String(req.body.password || '');
        const roleId = String(req.body.roleId || '');
        if (!email || !name || !password || !roleId) {
            return (0, response_1.fail)(res, 'الاسم والبريد وكلمة المرور والدور مطلوبة', 400);
        }
        if (password.length < 8)
            return (0, response_1.fail)(res, 'كلمة المرور يجب ألا تقل عن 8 أحرف', 400);
        const role = await prisma_1.prisma.role.findUnique({ where: { id: roleId } });
        if (!role)
            return (0, response_1.fail)(res, 'الدور غير موجود', 400);
        const user = await prisma_1.prisma.adminUser.create({
            data: {
                email,
                name,
                passwordHash: await bcryptjs_1.default.hash(password, 10),
                roleId,
                active: req.body.active !== false,
            },
            include: { role: true },
        });
        return (0, response_1.ok)(res, userPublic(user), 201);
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
});
router.put('/users/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('users', 'update'), async (req, res) => {
    try {
        const existing = await prisma_1.prisma.adminUser.findUnique({
            where: { id: req.params.id },
            include: { role: true },
        });
        if (!existing)
            return (0, response_1.fail)(res, 'Not found', 404);
        const data = {};
        if (req.body.name != null)
            data.name = String(req.body.name).trim();
        if (req.body.email != null)
            data.email = String(req.body.email).trim().toLowerCase();
        if (req.body.active != null) {
            if (req.params.id === req.admin.id && req.body.active === false) {
                return (0, response_1.fail)(res, 'لا يمكنك تعطيل حسابك الحالي', 400);
            }
            if (existing.role.slug === permissions_1.SUPER_ADMIN_SLUG &&
                existing.active &&
                req.body.active === false &&
                (await countSuperAdmins()) <= 1) {
                return (0, response_1.fail)(res, 'لا يمكن تعطيل آخر مدير نظام نشط', 400);
            }
            data.active = Boolean(req.body.active);
        }
        if (req.body.roleId != null) {
            const role = await prisma_1.prisma.role.findUnique({ where: { id: String(req.body.roleId) } });
            if (!role)
                return (0, response_1.fail)(res, 'الدور غير موجود', 400);
            if (existing.role.slug === permissions_1.SUPER_ADMIN_SLUG &&
                role.slug !== permissions_1.SUPER_ADMIN_SLUG &&
                existing.active &&
                (await countSuperAdmins()) <= 1) {
                return (0, response_1.fail)(res, 'لا يمكن تغيير دور آخر مدير نظام نشط', 400);
            }
            data.roleId = role.id;
        }
        if (req.body.password) {
            if (String(req.body.password).length < 8) {
                return (0, response_1.fail)(res, 'كلمة المرور يجب ألا تقل عن 8 أحرف', 400);
            }
            data.passwordHash = await bcryptjs_1.default.hash(String(req.body.password), 10);
        }
        const user = await prisma_1.prisma.adminUser.update({
            where: { id: req.params.id },
            data,
            include: { role: true },
        });
        return (0, response_1.ok)(res, userPublic(user));
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
});
router.delete('/users/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('users', 'delete'), async (req, res) => {
    if (req.params.id === req.admin.id) {
        return (0, response_1.fail)(res, 'لا يمكنك حذف حسابك الحالي', 400);
    }
    const existing = await prisma_1.prisma.adminUser.findUnique({
        where: { id: req.params.id },
        include: { role: true },
    });
    if (!existing)
        return (0, response_1.fail)(res, 'Not found', 404);
    if (existing.role.slug === permissions_1.SUPER_ADMIN_SLUG &&
        existing.active &&
        (await countSuperAdmins()) <= 1) {
        return (0, response_1.fail)(res, 'لا يمكن حذف آخر مدير نظام نشط', 400);
    }
    await prisma_1.prisma.adminUser.delete({ where: { id: req.params.id } });
    return (0, response_1.ok)(res, { deleted: true });
});
exports.default = router;
