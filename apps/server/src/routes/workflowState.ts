// ==================== WORKFLOW STATE API V2.0 ====================
// DG STOK V5.0 - Merkezi WorkflowState Yönetimi
// KURAL 3: Dashboard, Ürün Hazırlama, Gönderime Hazır aynı veriyi gösterir.
// KURAL 4: Hiçbir modül kendi başına hesap yapmaz.
// =================================================================

import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.ts';
import { prisma } from '../db/prisma.ts';
import { EventBus } from '../services/eventBus/EventBus.ts';
import { createCorrelationId } from '../services/eventBus/events.ts';
import { WorkflowStateManager } from '../services/workflow/WorkflowStateManager.ts';
import { AutoRecalculationEngine } from '../services/autoRecalculation/AutoRecalculationEngine.ts';
import { SummaryService } from '../services/autoRecalculation/SummaryService.ts';
import { DashboardService } from '../services/dashboard/DashboardService.ts';

const router = Router();

// ==================== STATS ====================

// GET /api/workflow-state/stats - WorkflowState istatistikleri
router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const stats = await WorkflowStateManager.getStats();
    res.json({ ok: true, ...stats });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== PRODUCTS ====================

// GET /api/workflow-state/products - Ürün listesi (WorkflowState bazlı)
router.get('/products', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const status = req.query.status ? String(req.query.status) : null;
    const search = String(req.query?.search ?? '').trim();

    const where: any = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.workflowState.findMany({
        where,
        orderBy: { readiness: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workflowState.count({ where }),
    ]);

    // Ürün bilgilerini ekle
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true, title: true, xmlKey: true, images: true,
        salePrice: true, stock: true, sku: true, barcode: true,
        categoryId: true, brandId: true,
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        xmlSource: { select: { id: true, name: true } },
      },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const result = items.map(w => ({
      ...w,
      product: productMap.get(w.productId) || null,
      readinessColor: w.readiness >= 100 ? 'bg-green-500' :
        w.readiness >= 80 ? 'bg-yellow-400' :
        w.readiness >= 60 ? 'bg-orange-400' :
        w.readiness >= 40 ? 'bg-red-400' : 'bg-red-700',
      readinessLabel: w.readiness >= 100 ? 'Hazır' :
        w.readiness >= 80 ? 'Kontrol Edilmeli' :
        w.readiness >= 60 ? 'Eksikler Var' :
        w.readiness >= 40 ? 'Gönderilemez' : 'Kritik',
    }));

    res.json({ items: result, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Ürünler alınamadı' } });
  }
});

// ==================== PRODUCT DETAIL ====================

// GET /api/workflow-state/product/:productId - Tek ürün workflow detayı
router.get('/product/:productId', requireAuth, async (req, res) => {
  try {
    const ws = await prisma.workflowState.findUnique({ where: { productId: req.params.productId } });
    const product = await prisma.product.findUnique({
      where: { id: req.params.productId },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        xmlSource: { select: { id: true, name: true } },
      },
    });
    const timeline = await prisma.workflowTimeline.findMany({
      where: { productId: req.params.productId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ workflow: ws, product, timeline });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Detay alınamadı' } });
  }
});

// ==================== SYNC ====================

// POST /api/workflow-state/sync - Tüm ürünleri WorkflowState ile senkronize et
router.post('/sync', requireAuth, async (_req, res) => {
  try {
    const count = await WorkflowStateManager.syncAllFromProducts();
    SummaryService.clearCache();
    DashboardService.clearCache();
    res.json({ ok: true, syncedCount: count, message: `${count} ürün WorkflowState ile senkronize edildi` });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/workflow-state/sync/:productId - Tek ürünü senkronize et
router.post('/sync/:productId', requireAuth, async (req, res) => {
  try {
    await WorkflowStateManager.syncFromProduct(req.params.productId);
    SummaryService.clearCache();
    DashboardService.clearCache();
    res.json({ ok: true, message: 'Ürün senkronize edildi' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== TIMELINE ====================

// POST /api/workflow-state/timeline - Timeline event ekle
router.post('/timeline', requireAuth, async (req, res) => {
  try {
    const { productId, event, details } = req.body;
    if (!productId || !event) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productId ve event zorunludur' } });
    }
    const item = await prisma.workflowTimeline.create({
      data: {
        productId,
        event,
        details: details ? JSON.stringify(details) : null,
        actorUserId: (req as any).actor?.userId,
      },
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Olay eklenemedi' } });
  }
});

// GET /api/workflow-state/events - Son event'leri göster (debug)
router.get('/events', requireAuth, async (_req, res) => {
  try {
    const { EventBus } = await import('../services/eventBus/EventBus.ts');
    const events = EventBus.getHistory(50);
    res.json({ ok: true, events, handlerCount: EventBus.handlerCount() });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== READY TO SEND ====================

// GET /api/workflow-state/ready-to-send/:productId - Tek ürün için RTS kontrolü
router.get('/ready-to-send/:productId', requireAuth, async (req, res) => {
  try {
    const result = await WorkflowStateManager.calculateReadyToSend(req.params.productId);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/workflow-state/ready-to-send - Hazır ürünlerin listesi
router.get('/ready-to-send', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const [items, total] = await Promise.all([
      prisma.workflowState.findMany({
        where: { status: 'READY' },
        orderBy: { readiness: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workflowState.count({ where: { status: 'READY' } }),
    ]);
    res.json({ ok: true, items, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== TIMELINE ====================

// GET /api/workflow-state/timeline/:productId - Ürün zaman çizelgesi
router.get('/timeline/:productId', requireAuth, async (req, res) => {
  try {
    const timeline = await prisma.workflowTimeline.findMany({
      where: { productId: req.params.productId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ ok: true, items: timeline });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== DEBUG / TEST ====================

// POST /api/workflow-state/test/cascade - Cascade testi
router.post('/test/cascade', requireAuth, async (req, res) => {
  try {
    const { productIds, triggerModule, newValue } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productIds array required' } });
    }
    if (!['CATEGORY', 'BRAND', 'VARIANT', 'TEMPLATE'].includes(triggerModule)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'triggerModule must be CATEGORY, BRAND, VARIANT, or TEMPLATE' } });
    }

    const startTime = Date.now();
    const result = await WorkflowStateManager.onModuleChanged(
      productIds,
      triggerModule,
      newValue ?? true,
      'manual'
    );

    // AutoRecalculation'ı tetikle
    for (const productId of productIds) {
      await AutoRecalculationEngine.onProductChanged(productId, `test_${triggerModule}`);
    }

    SummaryService.clearCache();
    DashboardService.clearCache();

    const duration = Date.now() - startTime;
    res.json({
      ok: true,
      duration,
      triggerModule,
      newValue: newValue ?? true,
      result,
      message: `${triggerModule} cascade test: ${result.updatedCount} ürün güncellendi, ` +
        `zincir: ${result.cascadeChain.join('→') || '(yok)'}, ${duration}ms`,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
