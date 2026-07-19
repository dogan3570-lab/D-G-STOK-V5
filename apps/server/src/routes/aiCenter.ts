// ==================== AI EKSİK BİLGİ MERKEZİ ROUTES ====================
// DG STOK V5.0
// ========================================================================

import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { AIAnalysisEngine } from '../services/aiEngine/AIAnalysisEngine.ts';
import { prisma } from '../db/prisma.ts';

const router = Router();

// GET /api/ai-center/analyze/:productId - Tek ürün analizi
router.get('/analyze/:productId', requireAuth, async (req, res) => {
  try {
    const result = await AIAnalysisEngine.analyzeProduct(req.params.productId);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/ai-center/summary - Özet istatistikler
router.get('/summary', requireAuth, async (_req, res) => {
  try {
    const total = await prisma.product.count();
    const missingCategory = await prisma.product.count({ where: { categoryId: null } });
    const missingBrand = await prisma.product.count({ where: { brandId: null } });
    const missingBarcode = await prisma.product.count({ where: { barcode: null } });
    const missingPrice = await prisma.product.count({ where: { salePrice: null } });

    res.json({
      ok: true, data: {
        totalProducts: total,
        missingCategory, missingBrand,
        missingBarcode, missingPrice,
      }
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
