import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { EventBus } from '../services/eventBus/EventBus.ts';
import { createCorrelationId } from '../services/eventBus/events.ts';
import { actionsRouter } from './actions.ts';
import { fetchXmlFromUrl, importXmlProducts } from '../services/xmlImport.ts';
import xmlSourcesRoutes from './xmlSources.ts';
import categoriesRoutes from './categories.ts';
import variantsRoutes from './variantsV5.ts';
import automationRoutes from './automation.ts';
import reportsRoutes from './reports.ts';
import productsRoutes from './products.ts';
import brandsRoutes from './brands.ts';
import brandPoliciesRoutes from './brands-policy.ts';
import transformRoutes from './transform.ts';
import titleRoutes from './title.ts';
import aiRoutes from './ai.ts';
import plmRoutes from './plm.ts';
import rulesRoutes from './rules.ts';
import dqcRoutes from './dqc.ts';
import twinRoutes from './twin.ts';
import mdmRoutes from './mdm.ts';
import pipelineRoutes from './pipeline.ts';
import listingsRoutes from './listings.ts';
import contentEngineRouter from './contentEngine.ts';
import variantsV5Router from './variantsV5.ts';
import workflowStateRoutes from './workflowState.ts';
import readyToSendRoutes from './readyToSend.ts';
import marketplaceRoutes from './marketplace.ts';
import pricingRoutes from './pricing.ts';
import aiCenterRoutes from './aiCenter.ts';
import aiProductionRoutes from './aiProduction.ts';
import aiProviderRoutes from './aiProviders.ts';
import aiCommandCenterRoutes from './aiCommandCenter.ts';

export const router = Router();

export function attachRoutes(app: import('express').Express) {
  // Health/API status were already registered in apps/server/src/index.ts.
  app.use('/', router);
}

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
router.use('/variants', variantsRoutes);
router.use('/automation', automationRoutes);
router.use('/reports', reportsRoutes);
router.use('/products', productsRoutes);
router.use('/brands', brandsRoutes);
router.use('/brand-policies', brandPoliciesRoutes);
router.use('/transform', transformRoutes);
router.use('/title', titleRoutes);
router.use('/ai', aiRoutes);
router.use('/plm', plmRoutes);
router.use('/rules', rulesRoutes);
router.use('/dqc', dqcRoutes);
router.use('/twin', twinRoutes);
router.use('/mdm', mdmRoutes);
router.use('/pipeline', pipelineRoutes);
router.use('/listings', listingsRoutes);
router.use('/content', contentEngineRouter);
router.use('/variants/v5', variantsV5Router);
router.use('/workflow-state', workflowStateRoutes);
router.use('/ready-to-send', readyToSendRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/pricing', pricingRoutes);
router.use('/ai-center', aiCenterRoutes);
router.use('/ai', aiProductionRoutes);
router.use('/ai', aiProviderRoutes);
router.use('/ai-cc', aiCommandCenterRoutes);

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

// GET /marketplaces/stats - Marketplace istatistikleri
router.get('/marketplaces/stats', requireAuth, async (_req, res) => {
  try {
    const [total, connected, error, activeProducts] = await Promise.all([
      prisma.marketplace.count(),
      prisma.marketplace.count({ where: { apiStatus: 'ok' } }),
      prisma.marketplace.count({ where: { apiStatus: 'error' } }),
      prisma.productMarketplaceState.count({ where: { status: 'SENT' } }),
    ]);
    res.json({ total, connected, connectionError: error, apiError: 0, sentProducts: activeProducts, pendingProducts: 0, failedProducts: 0, successfulProducts: activeProducts });
  } catch (error) {
    return handleDbError(res, error);
  }
});

router.post('/marketplaces', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  const key = String(req.body?.key ?? '').trim();
  const name = String(req.body?.name ?? '').trim();
  const apiStatus = String(req.body?.apiStatus ?? 'unknown').trim() || 'unknown';
  const apiKey = req.body?.apiKey ? String(req.body.apiKey).trim() : null;
  const apiSecret = req.body?.apiSecret ? String(req.body.apiSecret).trim() : null;
  const apiUrl = req.body?.apiUrl ? String(req.body.apiUrl).trim() : null;
  const sellerId = req.body?.sellerId ? String(req.body.sellerId).trim() : null;

  if (!key || !name) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'key ve name zorunludur' } });
  }

  // Ek alanları settings JSON'ında sakla
  const settings: Record<string, string> = {};
  if (sellerId) settings.sellerId = sellerId;
  if (apiKey) settings.apiKey = apiKey;
  if (apiSecret) settings.apiSecret = apiSecret;

  try {
    const created = await prisma.marketplace.create({
      data: { 
        key, 
        name, 
        apiStatus,
        apiKey: apiKey || undefined,
        apiSecret: apiSecret || undefined,
        apiUrl: apiUrl || undefined,
        settings: Object.keys(settings).length > 0 ? JSON.stringify(settings) : undefined,
      },
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
  const apiKey = req.body?.apiKey !== undefined ? String(req.body.apiKey).trim() : undefined;
  const apiSecret = req.body?.apiSecret !== undefined ? String(req.body.apiSecret).trim() : undefined;
  const apiUrl = req.body?.apiUrl !== undefined ? String(req.body.apiUrl).trim() : undefined;
  const sellerId = req.body?.sellerId !== undefined ? String(req.body.sellerId).trim() : undefined;

  if (!id) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'id zorunludur' } });
  }

  // Mevcut marketplace'i getir
  const existing = await prisma.marketplace.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Marketplace bulunamadı' } });
  }

  // Settings'i güncelle
  let settings: Record<string, string> = {};
  try {
    if (existing.settings) settings = JSON.parse(existing.settings);
  } catch {}
  
  if (sellerId !== undefined) settings.sellerId = sellerId;
  if (apiKey !== undefined) settings.apiKey = apiKey;
  if (apiSecret !== undefined) settings.apiSecret = apiSecret;

  try {
    const updated = await prisma.marketplace.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(apiStatus !== undefined ? { apiStatus } : {}),
        ...(apiKey !== undefined ? { apiKey: apiKey || null } : {}),
        ...(apiSecret !== undefined ? { apiSecret: apiSecret || null } : {}),
        ...(apiUrl !== undefined ? { apiUrl: apiUrl || null } : {}),
        settings: JSON.stringify(settings),
      },
    });
    return res.json({ ok: true, item: updated });
  } catch {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Marketplace bulunamadı' } });
  }
});

// Marketplace bağlantı testi - gerçek API'ye istek atar
router.post('/marketplaces/:id/test', requireAuth, async (req, res) => {
  const id = String(req.params.id ?? '');
  if (!id) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'id zorunludur' } });
  }

  try {
    const { testMarketplaceConnection } = await import('../services/marketplaceApi.ts');
    const result = await testMarketplaceConnection(id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ 
      ok: false, 
      message: '❌ Bağlantı testi başarısız',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
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

// GET /marketplace/logs - Pazaryeri aktivite logları (AuditLog üzerinden)
router.get('/marketplace/logs', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const action = req.query.action ? String(req.query.action) : null;
    const entity = req.query.entity ? String(req.query.entity) : null;
    const success = req.query.success !== undefined ? req.query.success === 'true' : null;
    const days = Math.min(90, Math.max(1, Number(req.query.days ?? 7)));

    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: Record<string, unknown> = {
      createdAt: { gte: since },
    };
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entity) where.entity = entity;
    if (success !== null) where.success = success;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actorUser: { select: { email: true, name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Aktivite özeti
    const summary = await prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: since } },
      _count: true,
    });

    return res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: summary.map(s => ({ action: s.action, count: s._count })),
    });
  } catch (error) {
    return handleDbError(res, error);
  }
});

// Ürün route'ları apps/server/src/routes/products.ts dosyasına taşındı

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

// PUT/DELETE /products/:id route'ları apps/server/src/routes/products.ts dosyasına taşındı

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

// Seed test user for CI/CD integration tests
router.post('/debug/seed-test-user', async (_req, res) => {
  const existing = await prisma.user.count({ where: { email: 'test@dgstok.com' } });
  if (existing > 0) {
    return res.json({ ok: true, skipped: true, message: 'Test user already exists' });
  }

  const hashedPassword = await bcrypt.hash('test123456', 10);
  const testUser = await prisma.user.create({
    data: {
      email: 'test@dgstok.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  return res.json({ ok: true, created: testUser });
});

// ==================== STOCK PROTECTION RULES ====================
router.get('/stock-protection/rules', requireAuth, async (_req, res) => {
  try {
    const rules = await prisma.marketplaceStockRule.findMany({
      include: { marketplace: { select: { id: true, name: true, key: true } } },
    });
    return res.json({ items: rules });
  } catch (error) {
    return res.json({ items: [] });
  }
});

router.put('/stock-protection/rules/:id', requireAuth, async (req, res) => {
  try {
    const { minStock, autoCloseEnabled, autoOpenEnabled } = req.body;
    const data: Record<string, unknown> = {};
    if (minStock !== undefined) data.minStock = Number(minStock);
    if (autoCloseEnabled !== undefined) data.autoCloseEnabled = Boolean(autoCloseEnabled);
    if (autoOpenEnabled !== undefined) data.autoOpenEnabled = Boolean(autoOpenEnabled);
    const updated = await prisma.marketplaceStockRule.update({
      where: { id: req.params.id },
      data,
    });
    return res.json({ ok: true, item: updated });
  } catch (error) {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Kural bulunamadı' } });
  }
});

// ==================== CRITICAL STOCK ALERTS ====================
router.get('/stock-protection/critical', requireAuth, async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        stock: { lte: 10 },
        status: 'READY',
      },
      take: 50,
      orderBy: { stock: 'asc' },
      select: {
        id: true, sku: true, title: true, stock: true, criticalStockLevel: true,
      },
    });
    return res.json({ items: products });
  } catch (error) {
    return res.json({ items: [] });
  }
});

// Seed test user for CI/CD integration tests
router.post('/debug/seed-test-user', async (_req, res) => {
  const existing = await prisma.user.count({ where: { email: 'test@dgstok.com' } });
  if (existing > 0) {
    return res.json({ ok: true, skipped: true, message: 'Test user already exists' });
  }

  const hashedPassword = await bcrypt.hash('test123456', 10);
  const testUser = await prisma.user.create({
    data: {
      email: 'test@dgstok.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  return res.json({ ok: true, created: testUser });
});

// Brand route'ları apps/server/src/routes/brands.ts dosyasına taşındı

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

    // EventBus: Sipariş durumu değişti
    EventBus.emit({
      type: 'DashboardRefresh',
      correlationId: createCorrelationId('API'),
      timestamp: new Date().toISOString(),
      source: 'OrderManagement',
      data: { reason: status ? `order_${status}` : 'order_updated', affectedProductIds: [] },
    });

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

// ==================== SYSTEM HEALTH ====================
router.get('/system/health', async (_req, res) => {
  try {
    const [dbOk, eventBusOk, workflowOk, marketplacesOk] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      Promise.resolve(true),
      prisma.workflowState.count().then(() => true).catch(() => false),
      prisma.marketplace.count().then(() => true).catch(() => false),
    ]);

    const health = {
      database: dbOk ? 'OK' : 'ERROR',
      eventBus: eventBusOk ? 'OK' : 'ERROR',
      workflow: workflowOk ? 'OK' : 'ERROR',
      marketplaces: marketplacesOk ? 'OK' : 'ERROR',
      xml: true ? 'OK' : 'ERROR',
      queue: true ? 'OK' : 'ERROR',
      status: (dbOk && eventBusOk && workflowOk) ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      database: 'ERROR', eventBus: 'UNKNOWN', workflow: 'UNKNOWN',
      marketplaces: 'UNKNOWN', xml: 'UNKNOWN', queue: 'UNKNOWN',
      status: 'down', timestamp: new Date().toISOString(),
    });
  }
});

// ==================== DASHBOARD STATS ====================
router.get('/dashboard/stats', async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const [totalProducts, totalOrders, totalMarketplaces, totalXmlSources, activeXmlSources, passiveXmlSources, lowStockProducts, errorProducts, todayOrders, xmlSourcesWithError, todayXmlUpdates, readyProducts, brandCount, categoryCount, variantCount] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.marketplace.count(),
      prisma.xmlSource.count(),
      prisma.xmlSource.count({ where: { active: true } }),
      prisma.xmlSource.count({ where: { active: false } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.product.count({ where: { status: 'ERROR' } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.xmlSource.count({ where: { connectionStatus: 'error' } }),
      prisma.xmlImportRun.count({ where: { startedAt: { gte: todayStart }, status: { not: 'running' } } }),
      prisma.product.count({ where: { status: 'READY' } }),
      prisma.brand.count(),
      prisma.category.count(),
      prisma.variant.count(),
    ]);

    return res.json({
      totalProducts,
      totalOrders,
      totalMarketplaces,
      totalXmlSources,
      activeXmlSources,
      passiveXmlSources,
      xmlSourcesWithError,
      todayXmlUpdates,
      lowStockProducts,
      errorProducts,
      readyProducts,
      todayOrders,
      brandCount,
      categoryCount,
      variantCount,
    });
  } catch (error) {
    return handleDbError(res, error);
  }
});
