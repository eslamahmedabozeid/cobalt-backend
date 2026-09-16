import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { ok, fail } from '../utils/response';
import { requireAdmin } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const router = Router();

function listActive(model: any, orderBy: object = { sortOrder: 'asc' }) {
  return async (_req: any, res: any) => {
    const items = await model.findMany({ where: { active: true }, orderBy });
    return ok(res, items);
  };
}

function adminCrud(modelName: keyof typeof prisma, orderBy: object = { sortOrder: 'asc' }) {
  const r = Router();
  const db = prisma[modelName] as any;

  r.get('/', requireAdmin, async (_req, res) => {
    return ok(res, await db.findMany({ orderBy }));
  });

  r.get('/:id', requireAdmin, async (req, res) => {
    const item = await db.findUnique({ where: { id: req.params.id } });
    if (!item) return fail(res, 'Not found', 404);
    return ok(res, item);
  });

  r.post('/', requireAdmin, async (req, res) => {
    try {
      return ok(res, await db.create({ data: req.body }), 201);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
  });

  r.put('/:id', requireAdmin, async (req, res) => {
    try {
      return ok(res, await db.update({ where: { id: req.params.id }, data: req.body }));
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

// —— Public CMS content ——
export const publicCmsRouter = Router();

publicCmsRouter.get('/homepage', async (_req, res) => {
  const [
    sections,
    featureBadges,
    trustStats,
    valueProps,
    howItWorks,
    processSteps,
    guarantees,
    comparison,
    inquiries,
    topBar,
    nav,
    footerLinks,
  ] = await Promise.all([
    prisma.contentSection.findMany({ where: { active: true } }),
    prisma.featureBadge.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.trustStat.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.valuePropCard.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.howItWorksStep.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.processStep.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.guaranteeCard.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.comparisonColumn.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { items: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.inquiriesCta.findFirst({ where: { id: 'default', active: true } }),
    prisma.topBarPromo.findFirst({ where: { id: 'default', active: true } }),
    prisma.navItem.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.footerLink.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const sectionMap = Object.fromEntries(sections.map((s) => [s.id, s]));
  return ok(res, {
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

publicCmsRouter.get('/feature-badges', listActive(prisma.featureBadge));
publicCmsRouter.get('/trust-stats', listActive(prisma.trustStat));
publicCmsRouter.get('/value-props', listActive(prisma.valuePropCard));
publicCmsRouter.get('/how-it-works', listActive(prisma.howItWorksStep));
publicCmsRouter.get('/process-steps', listActive(prisma.processStep));
publicCmsRouter.get('/guarantees', listActive(prisma.guaranteeCard));
publicCmsRouter.get('/nav', listActive(prisma.navItem));
publicCmsRouter.get('/footer-links', listActive(prisma.footerLink));
publicCmsRouter.get('/content-sections/:id', async (req, res) => {
  const item = await prisma.contentSection.findFirst({
    where: { id: req.params.id, active: true },
  });
  if (!item) return fail(res, 'Not found', 404);
  return ok(res, item);
});

publicCmsRouter.get('/comparison', async (_req, res) => {
  const columns = await prisma.comparisonColumn.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    include: { items: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
  });
  const header = await prisma.contentSection.findUnique({ where: { id: 'comparison' } });
  return ok(res, { header, columns });
});

publicCmsRouter.get('/inquiries-cta', async (_req, res) => {
  const item = await prisma.inquiriesCta.findUnique({ where: { id: 'default' } });
  if (!item || !item.active) return ok(res, null);
  return ok(res, item);
});

publicCmsRouter.get('/top-bar', async (_req, res) => {
  const item = await prisma.topBarPromo.findUnique({ where: { id: 'default' } });
  if (!item || !item.active) return ok(res, null);
  return ok(res, item);
});

// —— Admin CMS CRUD ——
export const adminCmsRouter = Router();

adminCmsRouter.use('/feature-badges', adminCrud('featureBadge'));
adminCmsRouter.use('/trust-stats', adminCrud('trustStat'));
adminCmsRouter.use('/value-props', adminCrud('valuePropCard'));
adminCmsRouter.use('/how-it-works', adminCrud('howItWorksStep'));
adminCmsRouter.use('/process-steps', adminCrud('processStep'));
adminCmsRouter.use('/guarantees', adminCrud('guaranteeCard'));
adminCmsRouter.use('/nav', adminCrud('navItem'));
adminCmsRouter.use('/footer-links', adminCrud('footerLink'));
adminCmsRouter.use('/categories', (() => {
  const r = Router();
  const db = prisma.category;
  r.get('/', requireAdmin, async (_req, res) => {
    return ok(res, await db.findMany({ orderBy: { sortOrder: 'asc' } }));
  });
  r.get('/:id', requireAdmin, async (req, res) => {
    const item = await db.findUnique({ where: { id: req.params.id } });
    if (!item) return fail(res, 'Not found', 404);
    return ok(res, item);
  });
  r.post('/', requireAdmin, async (req, res) => {
    try {
      return ok(res, await db.create({ data: req.body }), 201);
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
    }
  });
  r.put('/:id', requireAdmin, async (req, res) => {
    try {
      return ok(res, await db.update({ where: { id: req.params.id }, data: req.body }));
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
    }
  });
  r.delete('/:id', requireAdmin, async (req, res) => {
    const inUse = await prisma.service.count({ where: { category: req.params.id } });
    if (inUse > 0) {
      return fail(
        res,
        `Cannot delete category: ${inUse} service(s) still reference it. Reassign or disable instead.`,
        400,
        undefined,
        'CATEGORY_IN_USE'
      );
    }
    try {
      await db.delete({ where: { id: req.params.id } });
      return ok(res, { deleted: true });
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'Delete failed', 400);
    }
  });
  return r;
})());
adminCmsRouter.use('/content-sections', adminCrud('contentSection', { id: 'asc' }));

adminCmsRouter.get('/comparison-columns', requireAdmin, async (_req, res) => {
  return ok(
    res,
    await prisma.comparisonColumn.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
  );
});

adminCmsRouter.post('/comparison-columns', requireAdmin, async (req, res) => {
  try {
    const { items, ...rest } = req.body;
    const col = await prisma.comparisonColumn.create({ data: rest });
    return ok(res, col, 201);
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
  }
});

adminCmsRouter.put('/comparison-columns/:id', requireAdmin, async (req, res) => {
  try {
    const { items, ...rest } = req.body;
    const col = await prisma.comparisonColumn.update({ where: { id: req.params.id }, data: rest });
    return ok(res, col);
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
  }
});

adminCmsRouter.delete('/comparison-columns/:id', requireAdmin, async (req, res) => {
  await prisma.comparisonColumn.delete({ where: { id: req.params.id } });
  return ok(res, { deleted: true });
});

adminCmsRouter.post('/comparison-items', requireAdmin, async (req, res) => {
  try {
    return ok(res, await prisma.comparisonItem.create({ data: req.body }), 201);
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Create failed', 400);
  }
});

adminCmsRouter.put('/comparison-items/:id', requireAdmin, async (req, res) => {
  try {
    return ok(res, await prisma.comparisonItem.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'Update failed', 400);
  }
});

adminCmsRouter.delete('/comparison-items/:id', requireAdmin, async (req, res) => {
  await prisma.comparisonItem.delete({ where: { id: req.params.id } });
  return ok(res, { deleted: true });
});

adminCmsRouter.get('/inquiries-cta', requireAdmin, async (_req, res) => {
  return ok(res, await prisma.inquiriesCta.findUnique({ where: { id: 'default' } }));
});

adminCmsRouter.put('/inquiries-cta', requireAdmin, async (req, res) => {
  return ok(
    res,
    await prisma.inquiriesCta.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...req.body },
      update: req.body,
    })
  );
});

adminCmsRouter.get('/top-bar', requireAdmin, async (_req, res) => {
  return ok(res, await prisma.topBarPromo.findUnique({ where: { id: 'default' } }));
});

adminCmsRouter.put('/top-bar', requireAdmin, async (req, res) => {
  return ok(
    res,
    await prisma.topBarPromo.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...req.body },
      update: req.body,
    })
  );
});

// Media uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({
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

adminCmsRouter.get('/media', requireAdmin, async (_req, res) => {
  return ok(res, await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } }));
});

adminCmsRouter.post('/media', requireAdmin, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return fail(res, err.message, 400);
    if (!req.file) return fail(res, 'No file uploaded', 400);
    const url = `/uploads/${req.file.filename}`;
    const asset = await prisma.mediaAsset.create({
      data: {
        filename: req.file.originalname,
        url,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
    return ok(res, asset, 201);
  });
});

adminCmsRouter.delete('/media/:id', requireAdmin, async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (!asset) return fail(res, 'Not found', 404);
  const filePath = path.join(uploadDir, path.basename(asset.url));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await prisma.mediaAsset.delete({ where: { id: req.params.id } });
  return ok(res, { deleted: true });
});
