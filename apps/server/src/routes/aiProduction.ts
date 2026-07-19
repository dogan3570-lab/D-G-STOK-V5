// ==================== AI PRODUCTION CENTER ROUTES ====================
// DG STOK V5.0 - AI destekli ürün analiz ve tarama
// ====================================================================

import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { prisma } from '../db/prisma.ts';
import { scanProduct, scanAllProducts, getDashboard } from '../services/aiProduction/scanner.ts';
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

export default router;
