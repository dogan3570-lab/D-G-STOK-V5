// ==================== DG STOK DASHBOARD API V1.0 ====================
// Kontrol Paneli API endpoint'leri
// ================================================================

import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.ts';
import { DashboardService } from '../services/dashboard/DashboardService.ts';

export const dashboardRouter = Router();

// GET /api/dashboard/summary - Ana Dashboard özeti (cache'li)
dashboardRouter.get('/summary', async (_req, res) => {
  try {
    const summary = await DashboardService.getSummary();
    res.json({ ok: true, ...summary });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/dashboard/activity - Aktivite akışı
dashboardRouter.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const events = await DashboardService.getActivity(limit);
    res.json({ ok: true, events });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/dashboard/cache-clear - Önbelleği temizle (sadece ADMIN)
dashboardRouter.post('/cache-clear', requireAuth, async (_req, res) => {
  try {
    DashboardService.clearCache();
    res.json({ ok: true, message: 'Dashboard cache cleared' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
