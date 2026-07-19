// ==================== DİNAMİK FİYAT MOTORU ROUTES ====================
// DG STOK V5.0
// ====================================================================

import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { prisma } from '../db/prisma.ts';
import { PricingEngine } from '../services/priceEngine/PricingEngine.ts';
import { EventBus } from '../services/eventBus/EventBus.ts';
import { createCorrelationId } from '../services/eventBus/events.ts';

const router = Router();

// GET /api/pricing/calculate/:productId - Fiyat hesapla
router.get('/calculate/:productId', requireAuth, async (req, res) => {
  try {
    const marketplaceKey = req.query.marketplace as string || 'trendyol';
    const result = await PricingEngine.calculate(req.params.productId, marketplaceKey);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/pricing/simulate - Simülasyon
router.post('/simulate', requireAuth, async (req, res) => {
  try {
    const { purchasePrice, vatRate, commissionRate, profitMargin, marketplaceKey } = req.body;
    const result = await PricingEngine.simulate(Number(purchasePrice), {
      vatRate: Number(vatRate), commissionRate: Number(commissionRate),
      profitMargin: Number(profitMargin), marketplaceKey,
    });
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/pricing/stats - Dashboard KPI
router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const stats = await PricingEngine.getStats();
    res.json({ ok: true, ...stats });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/pricing/bulk - Toplu fiyat güncelleme
router.post('/bulk', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { categoryId, brandId, xmlSourceId, marketplaceKey } = req.body;
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (xmlSourceId) where.xmlSourceId = xmlSourceId;

    const products = await prisma?.product.findMany({ where, select: { id: true }, take: 1000 }) || [];
    
    let updated = 0;
    const results = [];
    for (const p of products) {
      try {
        const price = await PricingEngine.calculate(p.id, marketplaceKey);
        results.push({ productId: p.id, finalPrice: price.finalPrice, profitPercent: price.profitPercent });
        updated++;
      } catch { /* skip failed */ }
    }

    EventBus.emit({
      type: 'DashboardRefresh',
      correlationId: createCorrelationId('API'),
      timestamp: new Date().toISOString(),
      source: 'PricingEngine',
      data: { reason: 'bulk_price_update', affectedProductIds: products.map(p => p.id) },
    });

    res.json({ ok: true, updated, total: products.length, results });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
