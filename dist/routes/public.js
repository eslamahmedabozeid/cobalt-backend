"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const response_1 = require("../utils/response");
const orders_1 = require("../services/orders");
const pricing_1 = require("../services/pricing");
const router = (0, express_1.Router)();
function parseJsonField(value, fallback) {
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
router.get('/categories', async (_req, res) => {
    const items = await prisma_1.prisma.category.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
    });
    if (items.length) {
        return (0, response_1.ok)(res, items.map((c) => ({ id: c.id, name: c.name, icon: c.icon })));
    }
    // fallback: derive from services
    const services = await prisma_1.prisma.service.findMany({
        where: { active: true },
        select: { category: true, categoryName: true },
        orderBy: { sortOrder: 'asc' },
    });
    const map = new Map();
    for (const s of services) {
        if (!map.has(s.category)) {
            map.set(s.category, { id: s.category, name: s.categoryName });
        }
    }
    return (0, response_1.ok)(res, Array.from(map.values()));
});
router.get('/health', (_req, res) => (0, response_1.ok)(res, { status: 'ok' }));
router.get('/services', async (_req, res) => {
    const services = await prisma_1.prisma.service.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        include: {
            packages: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
            addons: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
            requirementSchema: true,
        },
    });
    return (0, response_1.ok)(res, services.map((s) => ({
        ...s,
        deliverables: parseJsonField(s.deliverables, []),
        requirementSchema: s.requirementSchema
            ? parseJsonField(s.requirementSchema.schemaJson, {})
            : null,
    })));
});
router.get('/services/:slug', async (req, res) => {
    const service = await prisma_1.prisma.service.findFirst({
        where: { slug: req.params.slug, active: true },
        include: {
            packages: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
            addons: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
            requirementSchema: true,
        },
    });
    if (!service)
        return (0, response_1.fail)(res, 'Service not found', 404, undefined, 'NOT_FOUND');
    return (0, response_1.ok)(res, {
        ...service,
        deliverables: parseJsonField(service.deliverables, []),
        requirementSchema: service.requirementSchema
            ? parseJsonField(service.requirementSchema.schemaJson, {})
            : null,
    });
});
router.get('/bundles', async (_req, res) => {
    const bundles = await prisma_1.prisma.bundle.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
    });
    return (0, response_1.ok)(res, bundles);
});
router.get('/calculator', async (_req, res) => {
    const calc = await prisma_1.prisma.calculatorConfig.findUnique({ where: { id: 'default' } });
    if (!calc)
        return (0, response_1.fail)(res, 'Calculator config missing', 404);
    return (0, response_1.ok)(res, calc);
});
router.get('/coupons/validate', async (req, res) => {
    const code = String(req.query.code || '');
    try {
        // validate against a dummy subtotal of 100 to check existence/active
        const result = await (0, pricing_1.applyCoupon)(code, 100);
        if (!result.couponCode)
            return (0, response_1.fail)(res, 'Coupon required', 400);
        const coupon = await prisma_1.prisma.coupon.findUnique({ where: { code: result.couponCode } });
        return (0, response_1.ok)(res, {
            code: coupon.code,
            discountPercentage: coupon.discountPercentage,
            valid: true,
        });
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Invalid coupon', 400, undefined, 'INVALID_COUPON');
    }
});
router.get('/hero-slides', async (_req, res) => {
    const slides = await prisma_1.prisma.heroSlide.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
    });
    return (0, response_1.ok)(res, slides);
});
router.get('/portfolio', async (_req, res) => {
    const items = await prisma_1.prisma.portfolioItem.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
    });
    return (0, response_1.ok)(res, items.map((i) => ({ ...i, features: parseJsonField(i.features, []) })));
});
router.get('/testimonials', async (_req, res) => {
    const items = await prisma_1.prisma.testimonial.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
    });
    return (0, response_1.ok)(res, items);
});
router.get('/faqs', async (_req, res) => {
    const items = await prisma_1.prisma.faq.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
    });
    return (0, response_1.ok)(res, items);
});
router.get('/site-settings', async (_req, res) => {
    const settings = await prisma_1.prisma.siteSettings.findUnique({ where: { id: 'default' } });
    if (!settings)
        return (0, response_1.fail)(res, 'Settings not found', 404);
    return (0, response_1.ok)(res, {
        ...settings,
        paymentBadges: parseJsonField(settings.paymentBadges, []),
    });
});
router.get('/currencies', async (_req, res) => {
    const currencies = await prisma_1.prisma.currency.findMany({
        where: { active: true },
        orderBy: { code: 'asc' },
    });
    return (0, response_1.ok)(res, currencies);
});
router.post('/pricing/estimate', async (req, res) => {
    try {
        const estimate = await (0, orders_1.estimateOrder)(req.body);
        return (0, response_1.ok)(res, estimate);
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Estimate failed', 400, undefined, 'PRICING_ERROR');
    }
});
router.post('/orders', async (req, res) => {
    try {
        const order = await (0, orders_1.createOrder)(req.body);
        return (0, response_1.ok)(res, {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            subtotalSAR: order.subtotalSAR,
            discountSAR: order.discountSAR,
            totalSAR: order.totalSAR,
            couponCode: order.couponCode,
            items: order.items,
        }, 201);
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Order failed', 400, undefined, 'ORDER_ERROR');
    }
});
exports.default = router;
