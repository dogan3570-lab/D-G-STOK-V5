import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { actionsRouter } from './actions.ts';
import { fetchXmlFromUrl, importXmlProducts } from '../services/xmlImport.ts';
import xmlSourcesRoutes from './xmlSources.ts';
import categoriesRoutes from './categories.ts';

export function attachRoutes(app: import('express').Express) {
  // Health/API status were already registered in apps/server/src/index.ts.
  app.use('/', router);
}

export const router = Router();

function handleDbError(res: import('express').Response, error: unknown) {
  // eslint-disable-next-line no-console
  console.error('[routes][db]', error);
  return res.status(503).json({
    ok: false,
    error: {
      code: 'DB_UNAVAILABLE',
      message: 'Database is not reachable.',
    },
  });
}

router.use('/actions', actionsRouter);
router.use('/xml-sources', xmlSourcesRoutes);
router.use('/categories', categoriesRoutes);

router.post('/admin/change-password', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  const actor = (req as AuthedRequest).actor;
  const oldPassword = String(req.body?.oldPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');

  if (!actor?.userId) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
  }

  if (!oldPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'oldPassword ve min 6 karakter newPassword zorunludur' },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: actor.userId } });
  if (!user) {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı' } });
  }

  const oldOk = await bcrypt.compare(oldPassword, user.password);
  if (!oldOk) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_OLD_PASSWORD', message: 'Eski şifre hatalı' } });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  return res.json({ ok: true, message: 'Şifre güncellendi' });
});

// Public read
router.get('/marketplaces', async (_req, res) => {
  try {
    const items = await prisma.marketplace.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ items });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.post('/marketplaces', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  const key = String(req.body?.key ?? '').trim();
  const name = String(req.body?.name ?? '').trim();
  const apiStatus = String(req.body?.apiStatus ?? 'unknown').trim() || 'unknown';

  if (!key || !name) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'key ve name zorunludur' } });
  }

  try {
    const created = await prisma.marketplace.create({
      data: { key, name, apiStatus },
    });
    return res.status(201).json({ ok: true, item: created });
  } catch {
    return res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'Marketplace key zaten kayıtlı olabilir' } });
  }
});

router.put('/marketplaces/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  const id = String(req.params.id ?? '');
  const name = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
  const apiStatus = req.body?.apiStatus !== undefined ? String(req.body.apiStatus).trim() : undefined;

  if (!id) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'id zorunludur' } });
  }

  try {
    const updated = await prisma.marketplace.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(apiStatus !== undefined ? { apiStatus } : {}),
      },
    });
    return res.json({ ok: true, item: updated });
  } catch {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Marketplace bulunamadı' } });
  }
});

router.delete('/marketplaces/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  const id = String(req.params.id ?? '');
  if (!id) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'id zorunludur' } });
  }

  try {
    await prisma.marketplace.delete({ where: { id } });
    return res.json({ ok: true });
  } catch {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Marketplace bulunamadı' } });
  }
});

router.get('/products', async (req, res) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const categoryId = req.query?.categoryId ? String(req.query.categoryId) : null;
    const brandId = req.query?.brandId ? String(req.query.brandId) : null;
    const status = req.query?.status ? String(req.query.status) : null;
    const lowStock = req.query?.lowStock === 'true';
    const page = Math.max(1, Number(req.query?.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query?.limit ?? 50)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { xmlKey: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (brandId) {
      where.brandId = brandId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (lowStock) {
      where.stock = { lte: 0 };
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          variants: { select: { id: true, name: true, value: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({ 
      items, 
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// GET /products/:id - Get single product with full details
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        variants: true,
        xmlSource: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    return res.json(product);
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.post('/products', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  const xmlKey = String(req.body?.xmlKey ?? '').trim();
  const title = req.body?.title !== undefined ? String(req.body.title).trim() : null;
  const sku = req.body?.sku !== undefined ? String(req.body.sku).trim() : null;
  const barcode = req.body?.barcode !== undefined ? String(req.body.barcode).trim() : null;
  const stock = Number(req.body?.stock ?? 0);
  const minStock = Number(req.body?.minStock ?? 0);

  if (!xmlKey) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'xmlKey zorunludur' } });
  }

  try {
    const created = await prisma.product.create({
      data: {
        xmlKey,
        title,
        sku,
        barcode,
        stock: Number.isFinite(stock) ? stock : 0,
        minStock: Number.isFinite(minStock) ? minStock : 0,
      },
    });
    return res.status(201).json({ ok: true, item: created });
  } catch {
    return res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'Product xmlKey zaten kayıtlı olabilir' } });
  }
});

router.post('/xml/import', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  const xml = typeof req.body?.xml === 'string' ? req.body.xml : '';
  const xmlUrl = typeof req.body?.xmlUrl === 'string' ? req.body.xmlUrl.trim() : '';
  const sourceName = typeof req.body?.sourceName === 'string' ? req.body.sourceName.trim() : '';

  let payload = xml;

  if (!payload.trim() && xmlUrl) {
    try {
      payload = await fetchXmlFromUrl(xmlUrl);
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'XML_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'XML URL okunamadı',
        },
      });
    }
  }

  if (!payload.trim()) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'xml body zorunludur' } });
  }

  try {
    const result = await importXmlProducts(payload, {
      actorUserId: (req as AuthedRequest).actor?.userId ?? null,
      sourceName: sourceName || null,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: {
        code: 'IMPORT_FAILED',
        message: error instanceof Error ? error.message : 'XML import başarısız oldu',
      },
    });
  }
});

router.put('/products/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  const id = String(req.params.id ?? '');
  if (!id) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'id zorunludur' } });
  }

  const data: Record<string, unknown> = {};
  if (req.body?.title !== undefined) data.title = String(req.body.title).trim();
  if (req.body?.sku !== undefined) data.sku = String(req.body.sku).trim();
  if (req.body?.barcode !== undefined) data.barcode = String(req.body.barcode).trim();
  if (req.body?.stock !== undefined) data.stock = Number(req.body.stock);
  if (req.body?.minStock !== undefined) data.minStock = Number(req.body.minStock);

  try {
    const updated = await prisma.product.update({
      where: { id },
      data,
    });
    return res.json({ ok: true, item: updated });
  } catch {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Product bulunamadı' } });
  }
});

router.delete('/products/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  const id = String(req.params.id ?? '');
  if (!id) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'id zorunludur' } });
  }

  try {
    await prisma.product.delete({ where: { id } });
    return res.json({ ok: true });
  } catch {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Product bulunamadı' } });
  }
});

// Dashboard summary: product counts by marketplace and status
router.get('/dashboard/summary', async (_req, res) => {
  try {
    const states = await prisma.productMarketplaceState.findMany({
      include: {
        marketplace: true,
      },
    });

    // Group by marketplace
    const byMarketplace = new Map<string, {
      marketplaceId: string;
      marketplaceName: string;
      ready: number;
      sent: number;
      passive: number;
      error: number;
      total: number;
    }>();

    for (const s of states) {
      const key = s.marketplaceId;
      let entry = byMarketplace.get(key);
      if (!entry) {
        entry = {
          marketplaceId: key,
          marketplaceName: s.marketplace.name,
          ready: 0,
          sent: 0,
          passive: 0,
          error: 0,
          total: 0,
        };
        byMarketplace.set(key, entry);
      }
      entry.total += 1;
      switch (s.status) {
        case 'READY':
          entry.ready += 1;
          break;
        case 'SENT':
          entry.sent += 1;
          break;
        case 'PASSIVE':
          entry.passive += 1;
          break;
        case 'ERROR':
          entry.error += 1;
          break;
        // XML is not counted as a "processed" state
      }
    }

    const items = Array.from(byMarketplace.values());
    return res.json({ items });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// Protected example (admin/operator)
router.post(
  '/debug/seed-marketplaces',
  requireAuth,
  requireRole(['ADMIN', 'OPERATOR']),
  async (_req, res) => {
    const existing = await prisma.marketplace.count();
    if (existing > 0) {
      return res.json({ ok: true, skipped: true, existing });
    }

    await prisma.marketplace.createMany({
      data: [
        { key: 'tt', name: 'Trendyol', apiStatus: 'unknown' },
        { key: 'he', name: 'Hepsiburada', apiStatus: 'unknown' },
        { key: 'n11', name: 'N11', apiStatus: 'unknown' },
      ],
    });

    res.json({ ok: true, seeded: true });
  }
);

// Seed admin user (only for development)
router.post('/debug/seed-admin', async (_req, res) => {
  const existing = await prisma.user.count({ where: { email: 'admin@dgstok.com' } });
  if (existing > 0) {
    return res.json({ ok: true, skipped: true, message: 'Admin already exists' });
  }

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@dgstok.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  return res.json({ ok: true, created: admin });
});

// ==================== BRANDS ====================
router.get('/brands', async (_req, res) => {
  try {
    const items = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    return res.json({ items });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.post('/brands', requireAuth, async (req, res) => {
  try {
    const { name, externalId } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const item = await prisma.brand.create({ data: { name, externalId } });
    return res.status(201).json({ item });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.put('/brands/:id', requireAuth, async (req, res) => {
  try {
    const { name, externalId } = req.body;
    const item = await prisma.brand.update({ where: { id: req.params.id }, data: { name, externalId } });
    return res.json({ item });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.delete('/brands/:id', requireAuth, async (req, res) => {
  try {
    await prisma.brand.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== ORDERS ====================
router.get('/orders', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.order.count({ where }),
    ]);
    return res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.put('/orders/:id', requireAuth, async (req, res) => {
  try {
    const { status, cargoCompany, trackingNo } = req.body;
    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (cargoCompany) data.cargoCompany = cargoCompany;
    if (trackingNo) data.trackingNo = trackingNo;
    const item = await prisma.order.update({ where: { id: req.params.id }, data });
    return res.json({ item });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== NOTIFICATIONS ====================
router.get('/notifications', async (req, res) => {
  try {
    const items = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    const unread = await prisma.notification.count({ where: { read: false } });
    return res.json({ items, unread });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.post('/notifications', requireAuth, async (req, res) => {
  try {
    const { type, title, message } = req.body;
    const item = await prisma.notification.create({ data: { type, title, message } });
    return res.status(201).json({ item });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.post('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
    return res.json({ ok: true });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== SETTINGS ====================
router.get('/settings', async (_req, res) => {
  try {
    const items = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const s of items) map[s.key] = s.value;
    return res.json({ items: map });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.put('/settings', requireAuth, async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
    }
    return res.json({ ok: true });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== FINANCE ====================
router.get('/finance', async (req, res) => {
  try {
    const type = req.query.type ? String(req.query.type) : null;
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    const items = await prisma.financeRecord.findMany({ where, orderBy: { date: 'desc' }, take: 100 });
    const summary = await prisma.financeRecord.groupBy({ by: ['type'], _sum: { amount: true, profit: true, commission: true, vat: true } });
    return res.json({ items, summary });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== MESSAGES ====================
router.get('/messages', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const items = await prisma.message.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return res.json({ items });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.put('/messages/:id', requireAuth, async (req, res) => {
  try {
    const { status, aiSuggestion } = req.body;
    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (aiSuggestion) data.aiSuggestion = aiSuggestion;
    const item = await prisma.message.update({ where: { id: req.params.id }, data });
    return res.json({ item });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== SHIPMENTS ====================
router.get('/shipments', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const items = await prisma.shipment.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return res.json({ items });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== TEMPLATES ====================
router.get('/templates', async (_req, res) => {
  try {
    const items = await prisma.listingTemplate.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ items });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.post('/templates', requireAuth, async (req, res) => {
  try {
    const { name, marketplaceId, titleFormat, description, priceFormula, commissionRate, vatRate, cargoSettings, imageSettings, variantSettings } = req.body;
    const item = await prisma.listingTemplate.create({ data: { name, marketplaceId, titleFormat, description, priceFormula, commissionRate, vatRate, cargoSettings, imageSettings, variantSettings } });
    return res.status(201).json({ item });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.put('/templates/:id', requireAuth, async (req, res) => {
  try {
    const { name, titleFormat, description, priceFormula, commissionRate, vatRate, cargoSettings, imageSettings, variantSettings, active } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (titleFormat !== undefined) data.titleFormat = titleFormat;
    if (description !== undefined) data.description = description;
    if (priceFormula !== undefined) data.priceFormula = priceFormula;
    if (commissionRate !== undefined) data.commissionRate = commissionRate;
    if (vatRate !== undefined) data.vatRate = vatRate;
    if (cargoSettings !== undefined) data.cargoSettings = cargoSettings;
    if (imageSettings !== undefined) data.imageSettings = imageSettings;
    if (variantSettings !== undefined) data.variantSettings = variantSettings;
    if (active !== undefined) data.active = active;
    const item = await prisma.listingTemplate.update({ where: { id: req.params.id }, data });
    return res.json({ item });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.delete('/templates/:id', requireAuth, async (req, res) => {
  try {
    await prisma.listingTemplate.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== AUDIT LOGS ====================
router.get('/audit-logs', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { actorUser: { select: { email: true, name: true } } } }),
      prisma.auditLog.count(),
    ]);
    return res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== USERS ====================
router.get('/users', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try {
    const items = await prisma.user.findMany({ select: { id: true, email: true, role: true, name: true, createdAt: true } });
    return res.json({ items });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.put('/users/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { role, name } = req.body;
    const data: Record<string, unknown> = {};
    if (role) data.role = role;
    if (name) data.name = name;
    const item = await prisma.user.update({ where: { id: req.params.id }, data, select: { id: true, email: true, role: true, name: true } });
    return res.json({ item });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// ==================== DASHBOARD STATS ====================
router.get('/dashboard/stats', async (_req, res) => {
  try {
    const [totalProducts, totalOrders, totalMarketplaces, totalXmlSources, activeXmlSources, lowStockProducts, errorProducts, todayOrders] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.marketplace.count(),
      prisma.xmlSource.count(),
      prisma.xmlSource.count({ where: { active: true } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.product.count({ where: { status: 'ERROR' } }),
      prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);

    return res.json({
      totalProducts,
      totalOrders,
      totalMarketplaces,
      totalXmlSources,
      activeXmlSources,
      lowStockProducts,
      errorProducts,
      todayOrders,
    });
  } catch (error) {
    return handleDbError(res, error);
  }
});
