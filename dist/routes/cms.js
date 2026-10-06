"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCmsRouter = exports.publicCmsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const response_1 = require("../utils/response");
const auth_1 = require("../middleware/auth");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const permissions_1 = require("../lib/permissions");
const router = (0, express_1.Router)();
function listActive(model, orderBy = { sortOrder: 'asc' }) {
    return async (_req, res) => {
        const items = await model.findMany({ where: { active: true }, orderBy });
        return (0, response_1.ok)(res, items);
    };
}
function adminCrud(modelName, orderBy = { sortOrder: 'asc' }, resource = 'homepage') {
    const r = (0, express_1.Router)();
    const db = prisma_1.prisma[modelName];
    r.get('/', auth_1.requireAdmin, (0, auth_1.requirePermission)(resource, 'read'), async (_req, res) => {
        return (0, response_1.ok)(res, await db.findMany({ orderBy }));
    });
    r.get('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)(resource, 'read'), async (req, res) => {
        const item = await db.findUnique({ where: { id: req.params.id } });
        if (!item)
            return (0, response_1.fail)(res, 'Not found', 404);
        return (0, response_1.ok)(res, item);
    });
    r.post('/', auth_1.requireAdmin, (0, auth_1.requirePermission)(resource, 'create'), async (req, res) => {
        try {
            return (0, response_1.ok)(res, await db.create({ data: req.body }), 201);
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
        }
    });
    r.put('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)(resource, 'update'), async (req, res) => {
        try {
            return (0, response_1.ok)(res, await db.update({ where: { id: req.params.id }, data: req.body }));
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
// —— Public CMS content ——
exports.publicCmsRouter = (0, express_1.Router)();
exports.publicCmsRouter.get('/homepage', async (_req, res) => {
    const [sections, featureBadges, trustStats, valueProps, howItWorks, processSteps, guarantees, comparison, inquiries, topBar, nav, footerLinks,] = await Promise.all([
        prisma_1.prisma.contentSection.findMany({ where: { active: true } }),
        prisma_1.prisma.featureBadge.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.trustStat.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.valuePropCard.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.howItWorksStep.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.processStep.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.guaranteeCard.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.comparisonColumn.findMany({
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
            include: { items: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
        }),
        prisma_1.prisma.inquiriesCta.findFirst({ where: { id: 'default', active: true } }),
        prisma_1.prisma.topBarPromo.findFirst({ where: { id: 'default', active: true } }),
        prisma_1.prisma.navItem.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.footerLink.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    ]);
    const sectionMap = Object.fromEntries(sections.map((s) => [s.id, s]));
    return (0, response_1.ok)(res, {
        sections: sectionMap,
        featureBadges,
        trustStats,
        valueProps,
        howItWorks: { header: sectionMap['how-it-works'], steps: howItWorks },
        process: { header: sectionMap['process'], steps: processSteps },
        guarantees: { header: sectionMap['guarantees'], cards: guarantees },
        comparison: { header: sectionMap['comparison'], columns: comparison },
        valuePropHeader: sectionMap['value-props'],
        inquiries,
        topBar,
        nav,
        footerLinks,
    });
});
exports.publicCmsRouter.get('/feature-badges', listActive(prisma_1.prisma.featureBadge));
exports.publicCmsRouter.get('/trust-stats', listActive(prisma_1.prisma.trustStat));
exports.publicCmsRouter.get('/value-props', listActive(prisma_1.prisma.valuePropCard));
exports.publicCmsRouter.get('/how-it-works', listActive(prisma_1.prisma.howItWorksStep));
exports.publicCmsRouter.get('/process-steps', listActive(prisma_1.prisma.processStep));
exports.publicCmsRouter.get('/guarantees', listActive(prisma_1.prisma.guaranteeCard));
exports.publicCmsRouter.get('/nav', listActive(prisma_1.prisma.navItem));
exports.publicCmsRouter.get('/footer-links', listActive(prisma_1.prisma.footerLink));
exports.publicCmsRouter.get('/content-sections/:id', async (req, res) => {
    const item = await prisma_1.prisma.contentSection.findFirst({
        where: { id: req.params.id, active: true },
    });
    if (!item)
        return (0, response_1.fail)(res, 'Not found', 404);
    return (0, response_1.ok)(res, item);
});
exports.publicCmsRouter.get('/comparison', async (_req, res) => {
    const columns = await prisma_1.prisma.comparisonColumn.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        include: { items: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
    });
    const header = await prisma_1.prisma.contentSection.findUnique({ where: { id: 'comparison' } });
    return (0, response_1.ok)(res, { header, columns });
});
exports.publicCmsRouter.get('/inquiries-cta', async (_req, res) => {
    const item = await prisma_1.prisma.inquiriesCta.findUnique({ where: { id: 'default' } });
    if (!item || !item.active)
        return (0, response_1.ok)(res, null);
    return (0, response_1.ok)(res, item);
});
exports.publicCmsRouter.get('/top-bar', async (_req, res) => {
    const item = await prisma_1.prisma.topBarPromo.findUnique({ where: { id: 'default' } });
    if (!item || !item.active)
        return (0, response_1.ok)(res, null);
    return (0, response_1.ok)(res, item);
});
// —— Admin CMS CRUD ——
exports.adminCmsRouter = (0, express_1.Router)();
exports.adminCmsRouter.use('/feature-badges', adminCrud('featureBadge', { sortOrder: 'asc' }, 'homepage'));
exports.adminCmsRouter.use('/trust-stats', adminCrud('trustStat', { sortOrder: 'asc' }, 'homepage'));
exports.adminCmsRouter.use('/value-props', adminCrud('valuePropCard', { sortOrder: 'asc' }, 'homepage'));
exports.adminCmsRouter.use('/how-it-works', adminCrud('howItWorksStep', { sortOrder: 'asc' }, 'homepage'));
exports.adminCmsRouter.use('/process-steps', adminCrud('processStep', { sortOrder: 'asc' }, 'homepage'));
exports.adminCmsRouter.use('/guarantees', adminCrud('guaranteeCard', { sortOrder: 'asc' }, 'homepage'));
exports.adminCmsRouter.use('/nav', adminCrud('navItem', { sortOrder: 'asc' }, 'navigation'));
exports.adminCmsRouter.use('/footer-links', adminCrud('footerLink', { sortOrder: 'asc' }, 'footer-links'));
exports.adminCmsRouter.use('/categories', (() => {
    const r = (0, express_1.Router)();
    const db = prisma_1.prisma.category;
    r.get('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('categories', 'read'), async (_req, res) => {
        return (0, response_1.ok)(res, await db.findMany({ orderBy: { sortOrder: 'asc' } }));
    });
    r.get('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('categories', 'read'), async (req, res) => {
        const item = await db.findUnique({ where: { id: req.params.id } });
        if (!item)
            return (0, response_1.fail)(res, 'Not found', 404);
        return (0, response_1.ok)(res, item);
    });
    r.post('/', auth_1.requireAdmin, (0, auth_1.requirePermission)('categories', 'create'), async (req, res) => {
        try {
            return (0, response_1.ok)(res, await db.create({ data: req.body }), 201);
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
        }
    });
    r.put('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('categories', 'update'), async (req, res) => {
        try {
            return (0, response_1.ok)(res, await db.update({ where: { id: req.params.id }, data: req.body }));
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
        }
    });
    r.delete('/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('categories', 'delete'), async (req, res) => {
        const inUse = await prisma_1.prisma.service.count({ where: { category: req.params.id } });
        if (inUse > 0) {
            return (0, response_1.fail)(res, `Cannot delete category: ${inUse} service(s) still reference it. Reassign or disable instead.`, 400, undefined, 'CATEGORY_IN_USE');
        }
        try {
            await db.delete({ where: { id: req.params.id } });
            return (0, response_1.ok)(res, { deleted: true });
        }
        catch (e) {
            return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Delete failed', 400);
        }
    });
    return r;
})());
exports.adminCmsRouter.use('/content-sections', adminCrud('contentSection', { id: 'asc' }, 'homepage'));
exports.adminCmsRouter.get('/comparison-columns', auth_1.requireAdmin, (0, auth_1.requirePermission)('homepage', 'read'), async (_req, res) => {
    return (0, response_1.ok)(res, await prisma_1.prisma.comparisonColumn.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
    }));
});
exports.adminCmsRouter.post('/comparison-columns', auth_1.requireAdmin, (0, auth_1.requirePermission)('homepage', 'create'), async (req, res) => {
    try {
        const { items, ...rest } = req.body;
        const col = await prisma_1.prisma.comparisonColumn.create({ data: rest });
        return (0, response_1.ok)(res, col, 201);
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
});
exports.adminCmsRouter.put('/comparison-columns/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('homepage', 'update'), async (req, res) => {
    try {
        const { items, ...rest } = req.body;
        const col = await prisma_1.prisma.comparisonColumn.update({ where: { id: req.params.id }, data: rest });
        return (0, response_1.ok)(res, col);
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
});
exports.adminCmsRouter.delete('/comparison-columns/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('homepage', 'delete'), async (req, res) => {
    await prisma_1.prisma.comparisonColumn.delete({ where: { id: req.params.id } });
    return (0, response_1.ok)(res, { deleted: true });
});
exports.adminCmsRouter.post('/comparison-items', auth_1.requireAdmin, (0, auth_1.requirePermission)('homepage', 'update'), async (req, res) => {
    try {
        return (0, response_1.ok)(res, await prisma_1.prisma.comparisonItem.create({ data: req.body }), 201);
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
});
exports.adminCmsRouter.put('/comparison-items/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('homepage', 'update'), async (req, res) => {
    try {
        return (0, response_1.ok)(res, await prisma_1.prisma.comparisonItem.update({ where: { id: req.params.id }, data: req.body }));
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
});
exports.adminCmsRouter.delete('/comparison-items/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('homepage', 'update'), async (req, res) => {
    await prisma_1.prisma.comparisonItem.delete({ where: { id: req.params.id } });
    return (0, response_1.ok)(res, { deleted: true });
});
exports.adminCmsRouter.get('/inquiries-cta', auth_1.requireAdmin, (0, auth_1.requirePermission)('homepage', 'read'), async (_req, res) => {
    return (0, response_1.ok)(res, await prisma_1.prisma.inquiriesCta.findUnique({ where: { id: 'default' } }));
});
exports.adminCmsRouter.put('/inquiries-cta', auth_1.requireAdmin, (0, auth_1.requirePermission)('homepage', 'update'), async (req, res) => {
    return (0, response_1.ok)(res, await prisma_1.prisma.inquiriesCta.upsert({
        where: { id: 'default' },
        create: { id: 'default', ...req.body },
        update: req.body,
    }));
});
exports.adminCmsRouter.get('/top-bar', auth_1.requireAdmin, (0, auth_1.requirePermission)('top-bar', 'read'), async (_req, res) => {
    return (0, response_1.ok)(res, await prisma_1.prisma.topBarPromo.findUnique({ where: { id: 'default' } }));
});
exports.adminCmsRouter.put('/top-bar', auth_1.requireAdmin, (0, auth_1.requirePermission)('top-bar', 'update'), async (req, res) => {
    return (0, response_1.ok)(res, await prisma_1.prisma.topBarPromo.upsert({
        where: { id: 'default' },
        create: { id: 'default', ...req.body },
        update: req.body,
    }));
});
// Media uploads
const uploadDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'image/svg+xml') {
            return cb(new Error('SVG uploads are not allowed'));
        }
        if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
            return cb(new Error('Only images and PDF allowed'));
        }
        cb(null, true);
    },
});
exports.adminCmsRouter.get('/media', auth_1.requireAdmin, (0, auth_1.requirePermission)('media', 'read'), async (_req, res) => {
    return (0, response_1.ok)(res, await prisma_1.prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } }));
});
exports.adminCmsRouter.post('/media', auth_1.requireAdmin, (req, res, next) => {
    const admin = req.admin;
    if ((0, permissions_1.hasPermission)(admin.permissions, 'media', 'create', admin.isSuperAdmin)) {
        return next();
    }
    // Image uploads from service/content forms should not require a separate media tab grant.
    const writers = [
        'services',
        'bundles',
        'hero-slides',
        'portfolio',
        'testimonials',
        'settings',
        'homepage',
    ];
    const canWriteContent = writers.some((r) => (0, permissions_1.hasPermission)(admin.permissions, r, 'create', admin.isSuperAdmin) ||
        (0, permissions_1.hasPermission)(admin.permissions, r, 'update', admin.isSuperAdmin));
    if (canWriteContent)
        return next();
    return (0, response_1.fail)(res, 'ليس لديك صلاحية لتنفيذ هذا الإجراء', 403, undefined, 'FORBIDDEN');
}, (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err)
            return (0, response_1.fail)(res, err.message, 400);
        if (!req.file)
            return (0, response_1.fail)(res, 'No file uploaded', 400);
        const url = `/uploads/${req.file.filename}`;
        const asset = await prisma_1.prisma.mediaAsset.create({
            data: {
                filename: req.file.originalname,
                url,
                mimeType: req.file.mimetype,
                size: req.file.size,
            },
        });
        return (0, response_1.ok)(res, asset, 201);
    });
});
exports.adminCmsRouter.delete('/media/:id', auth_1.requireAdmin, (0, auth_1.requirePermission)('media', 'delete'), async (req, res) => {
    const asset = await prisma_1.prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
    if (!asset)
        return (0, response_1.fail)(res, 'Not found', 404);
    const filePath = path_1.default.join(uploadDir, path_1.default.basename(asset.url));
    if (fs_1.default.existsSync(filePath))
        fs_1.default.unlinkSync(filePath);
    await prisma_1.prisma.mediaAsset.delete({ where: { id: req.params.id } });
    return (0, response_1.ok)(res, { deleted: true });
});
