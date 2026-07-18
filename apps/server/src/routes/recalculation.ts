// ==================== AUTO RECALCULATION ROUTES ====================
// DG STOK V5.0 - Auto Recalculation Engine API
// ====================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/authMiddleware.ts';
import { AutoRecalculationEngine, SummaryService } from '../services/autoRecalculation/index.ts';

const router = Router();

// GET /api/recalculation/summary - Merkezi Ozet (TUM ekranlar icin TEK kaynak)
router.get('/summary', async (_req, res) => {
  try {
    const summary = await SummaryService.getSummary();
    res.json({ ok: true, ...summary });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/recalculation/trigger - Belirli bir urun icin yeniden hesaplama tetikle
router.post('/trigger', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { productId, trigger } = req.body;
    if (!productId) {
      return res.status(400).json({ ok: false, error: 'productId required' });
    }
    const log = await AutoRecalculationEngine.onProductChanged(productId, trigger || 'manual');
    res.json({ ok: true, log });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/recalculation/logs - Son yeniden hesaplama loglari
router.get('/logs', requireAuth, async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const logs = AutoRecalculationEngine.getLogs(limit);
  res.json({ ok: true, items: logs, count: logs.length });
});

// POST /api/recalculation/cache-clear - Cache temizle (admin)
router.post('/cache-clear', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  SummaryService.clearCache();
  res.json({ ok: true, message: 'Summary cache cleared' });
});

export default router;
