// ==================== AI PRODUCTION CENTER ROUTES ====================
// DG STOK V5.0 - AI destekli ürün analiz ve tarama
// ====================================================================

import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { prisma } from '../db/prisma.ts';
import { scanProduct, scanAllProducts, getDashboard } from '../services/aiProduction/scanner.ts';
import { suggestCategory, scanAllCategories, approveSuggestion, rejectSuggestion } from '../services/aiProduction/categoryEngine.ts';
import { suggestBrand, scanAllBrands, approveBrand, rejectBrand } from '../services/aiProduction/brandEngine.ts';
import { analyzeContent, scanAllContent, approveContent, rejectContent } from '../services/aiProduction/contentEngine.ts';
import { suggestVariants, scanAllVariants, approveVariant, rejectVariant } from '../services/aiProduction/variantEngine.ts';
import { EventBus } from '../services/eventBus/EventBus.ts';
import { createCorrelationId } from '../services/eventBus/events.ts';

const router = Router();

// GET /ai/dashboard - AI Dashboard
router.get('/dashboard', requireAuth, async (_req, res) => {
  try {
    const data = await getDashboard();
    res.json({ ok: true, ...data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /ai/products - AI ile taranmış ürün listesi
router.get('/products', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const status = req.query.status ? String(req.query.status) : undefined;

    const where: any = {};
    if (status) where.overallStatus = status.toUpperCase();

    const [items, total] = await Promise.all([
      prisma.aICheck.findMany({
        where, orderBy: { overallScore: 'asc' },
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.aICheck.count({ where }),
    ]);

    res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /ai/product/:id - Tek ürün AI analizi
router.get('/product/:id', requireAuth, async (req, res) => {
  try {
    let check = await prisma.aICheck.findUnique({ where: { productId: req.params.id } });
    if (!check) {
      await scanProduct(req.params.id);
      check = await prisma.aICheck.findUnique({ where: { productId: req.params.id } });
    }
    res.json({ ok: true, ...check });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /ai/scan - Tüm ürünleri tara
router.post('/scan', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try {
    const result = await scanAllProducts();
    // Dashboard refresh
    EventBus.emit({
      type: 'DashboardRefresh',
      correlationId: createCorrelationId('API'),
      timestamp: new Date().toISOString(),
      source: 'AIProduction',
      data: { reason: 'ai_scan_completed', affectedProductIds: [] },
    });
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /ai/scan/:productId - Tek ürün tara
router.post('/scan/:productId', requireAuth, async (req, res) => {
  try {
    const result = await scanProduct(req.params.productId);
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /ai/report - Rapor
router.get('/report', requireAuth, async (_req, res) => {
  try {
    const dashboard = await getDashboard();
    const distribution = await prisma.aICheck.groupBy({
      by: ['overallStatus'],
      _avg: { overallScore: true },
      _count: { overallStatus: true },
    });

    res.json({ ok: true, dashboard, distribution, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== AI KATEGORİ MOTORU ENDPOINT'LERİ ====================

// GET /ai/category/products - Kategori önerileri listesi
router.get('/category/products', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const status = req.query.status ? String(req.query.status) : undefined;
    const marketplace = req.query.marketplace ? String(req.query.marketplace) : undefined;

    const where: any = {};
    if (marketplace) where.marketplace = marketplace;
    if (status === 'pending') where.approved = false;
    else if (status === 'approved') where.approved = true;

    const [items, total] = await Promise.all([
      prisma.aICategorySuggestion.findMany({
        where, orderBy: { confidence: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.aICategorySuggestion.count({ where }),
    ]);

    res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /ai/category/:productId - Tek ürün kategori önerisi
router.get('/category/:productId', requireAuth, async (req, res) => {
  try {
    const marketplaceKey = String(req.query.marketplace || 'trendyol');
    const result = await suggestCategory(req.params.productId, marketplaceKey);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /ai/category/scan - Toplu kategori taraması
router.post('/category/scan', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try {
    const result = await scanAllCategories();
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /ai/category/approve - Öneriyi onayla
router.post('/category/approve', requireAuth, async (req, res) => {
  try {
    const { suggestionId } = req.body;
    if (!suggestionId) return res.status(400).json({ ok: false, error: 'suggestionId gerekli' });
    const result = await approveSuggestion(suggestionId);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /ai/category/reject - Öneriyi reddet
router.post('/category/reject', requireAuth, async (req, res) => {
  try {
    const { suggestionId } = req.body;
    if (!suggestionId) return res.status(400).json({ ok: false, error: 'suggestionId gerekli' });
    const result = await rejectSuggestion(suggestionId);
    res.json({ ...result, ok: result.ok ?? true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== AI BRAND ENGINE ENDPOINT'LERİ ====================

// GET /ai/brand/products - Marka önerileri
router.get('/brand/products', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const where: any = {};
    if (req.query.status === 'pending') where.approved = false;
    const [items, total] = await Promise.all([
      prisma.aIBrandSuggestion.findMany({ where, orderBy: { confidence: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.aIBrandSuggestion.count({ where }),
    ]);
    res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.get('/brand/:productId', requireAuth, async (req, res) => {
  try {
    const result = await suggestBrand(req.params.productId);
    res.json({ ok: true, ...result });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/brand/scan', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try { const r = await scanAllBrands(); res.json({ ok: true, ...r }); }
  catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/brand/approve', requireAuth, async (req, res) => {
  try {
    const { suggestionId } = req.body;
    if (!suggestionId) return res.status(400).json({ ok: false, error: 'suggestionId gerekli' });
    const r = await approveBrand(suggestionId);
    res.json({ ok: true, ...r });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/brand/reject', requireAuth, async (req, res) => {
  try {
    const { suggestionId } = req.body;
    const r = await rejectBrand(suggestionId);
    res.json({ ...r, ok: r.ok ?? true });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// ==================== AI VARIANT ENGINE ENDPOINT'LERİ ====================

router.get('/variant/products', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const where: any = {};
    if (req.query.status === 'pending') where.approved = false;
    const [items, total] = await Promise.all([
      prisma.aIVariantSuggestion.findMany({ where, orderBy: { confidence: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.aIVariantSuggestion.count({ where }),
    ]);
    res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.get('/variant/:productId', requireAuth, async (req, res) => {
  try {
    const result = await suggestVariants(req.params.productId);
    res.json({ ok: true, ...result });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/variant/scan', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try { const r = await scanAllVariants(); res.json({ ok: true, ...r }); }
  catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/variant/approve', requireAuth, async (req, res) => {
  try {
    const { suggestionId } = req.body;
    if (!suggestionId) return res.status(400).json({ ok: false, error: 'suggestionId gerekli' });
    const r = await approveVariant(suggestionId);
    res.json({ ok: true, ...r });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/variant/reject', requireAuth, async (req, res) => {
  try {
    const { suggestionId } = req.body;
    const r = await rejectVariant(suggestionId);
    res.json({ ...r, ok: r.ok ?? true });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// ==================== AI CONTENT & SEO ENGINE ENDPOINT'LERİ ====================

router.get('/content/products', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const where: any = {};
    if (req.query.status === 'pending') where.approved = false;
    const [items, total] = await Promise.all([
      prisma.aIContentSuggestion.findMany({ where, orderBy: { overallScore: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.aIContentSuggestion.count({ where }),
    ]);
    res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.get('/content/:productId', requireAuth, async (req, res) => {
  try {
    const result = await analyzeContent(req.params.productId);
    res.json({ ok: true, ...result });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/content/scan', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try { const r = await scanAllContent(); res.json({ ok: true, ...r }); }
  catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/content/approve', requireAuth, async (req, res) => {
  try {
    const { suggestionId } = req.body;
    if (!suggestionId) return res.status(400).json({ ok: false, error: 'suggestionId gerekli' });
    const r = await approveContent(suggestionId);
    res.json({ ok: true, ...r });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

router.post('/content/reject', requireAuth, async (req, res) => {
  try {
    const { suggestionId } = req.body;
    const r = await rejectContent(suggestionId);
    res.json({ ...r, ok: r.ok ?? true });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

export default router;
