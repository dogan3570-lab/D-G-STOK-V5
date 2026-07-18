import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.ts';
import { workflowEngine } from '../services/workflow/index.ts';

const router = Router();
const engine = workflowEngine;

// GET /api/workflow/status/:productId - Urun workflow durumu
router.get('/status/:productId', requireAuth, async (req, res) => {
  try {
    const status = await engine.getStatus(req.params.productId);
    res.json({ ok: true, status });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/workflow/start/:productId - Workflow baslat
router.post('/start/:productId', requireAuth, async (req, res) => {
  try {
    await engine.start(req.params.productId);
    res.json({ ok: true, message: 'Workflow started' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/workflow/step/:productId - Adim tamamla
router.post('/step/:productId', requireAuth, async (req, res) => {
  try {
    const { step } = req.body;
    const status = await engine.completeStep(req.params.productId, step);
    res.json({ ok: true, status });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/workflow/stats - Workflow istatistikleri
router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const stats = await engine.getStats();
    res.json({ ok: true, stats });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export { router as workflowV2Router };
