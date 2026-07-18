// ==================== VARYANT MOTORU V5.0 ROUTES ====================
// DG STOK V5.0 - Category-Based Smart Variant Engine
// =====================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/authMiddleware.ts';
import {
  runV5Pipeline,
  decideProductById,
  getCategoryConfig,
  updateCategoryVariantConfig,
  clearCategoryCache,
  getDecisionHistory,
} from '../services/variantEngineV5/index.ts';

const router = Router();

// ==================== PIPELINE ====================

// POST /variants/v5/run - V5 Pipeline'ı çalıştır
router.post('/run', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: any, res: any) => {
  try {
    const { xmlSourceId } = req.body;
    const result = await runV5Pipeline(xmlSourceId || undefined);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[V5] Pipeline error:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// POST /variants/v5/run/:xmlSourceId - Belirli XML kaynağı için pipeline
router.post('/run/:xmlSourceId', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: any, res: any) => {
  try {
    const result = await runV5Pipeline(req.params.xmlSourceId);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[V5] Pipeline error:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== TEK ÜRÜN ====================

// GET /variants/v5/decide/:productId - Tek ürün için karar
router.get('/decide/:productId', requireAuth, async (req: any, res: any) => {
  try {
    const decision = await decideProductById(req.params.productId);
    if (!decision) return res.status(404).json({ ok: false, error: 'Ürün bulunamadı' });
    return res.json({ ok: true, decision });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// GET /variants/v5/decide/:productId/history - Karar geçmişi
router.get('/decide/:productId/history', requireAuth, async (req: any, res: any) => {
  try {
    const history = await getDecisionHistory(req.params.productId, Number(req.query.limit) || 10);
    return res.json({ ok: true, items: history });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== KATEGORİ ====================

// GET /variants/v5/category/:categoryId - Kategori yapılandırması
router.get('/category/:categoryId', requireAuth, async (req: any, res: any) => {
  try {
    const config = await getCategoryConfig(req.params.categoryId);
    return res.json({ ok: true, config });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// PUT /variants/v5/category/:categoryId - Kategori yapılandırmasını güncelle
router.put('/category/:categoryId', requireAuth, requireRole(['ADMIN']), async (req: any, res: any) => {
  try {
    await updateCategoryVariantConfig(req.params.categoryId, req.body);
    clearCategoryCache();
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

export default router;
