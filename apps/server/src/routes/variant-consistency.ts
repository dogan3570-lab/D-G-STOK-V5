import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.ts';
import { syncAllVariantFields, getVariantStats } from '../services/variant/VariantConsistencyService.ts';

export const variantConsistencyRouter = Router();

// GET /api/variant-consistency/stats - Tutarli varyant istatistikleri
variantConsistencyRouter.get('/stats', requireAuth, async (_req, res) => {
  try {
    const stats = await getVariantStats();
    res.json({ ok: true, stats });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/variant-consistency/sync - Tum varyant alanlarini senkronize et
variantConsistencyRouter.post('/sync', requireAuth, async (_req, res) => {
  try {
    const result = await syncAllVariantFields();
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
