// ==================== AI COMMAND CENTER ROUTES ====================
// DG STOK V5.0
// ================================================================

import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { prisma } from '../db/prisma.ts';
import { AICommandCenter } from '../services/aiCommandCenter/AICommandCenter.ts';

const router = Router();

// GET /api/ai-cc/dashboard - Command Center Dashboard
router.get('/dashboard', requireAuth, async (_req, res) => {
  try { const data = await AICommandCenter.getDashboard(); res.json({ ok: true, ...data }); }
  catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// GET /api/ai-cc/issues - Tüm issue'lar
router.get('/issues', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const where: any = {};
    if (req.query.severity) where.severity = String(req.query.severity).toUpperCase();
    if (req.query.module) where.module = String(req.query.module);
    if (req.query.resolved === 'true') where.resolved = true;
    else if (req.query.resolved === 'false') where.resolved = false;

    const [items, total] = await Promise.all([
      prisma.aIIssue.findMany({ where, orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
      prisma.aIIssue.count({ where }),
    ]);
    res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// POST /api/ai-cc/scan/:productId - Ürün tara
router.post('/scan/:productId', requireAuth, async (req, res) => {
  try { const result = await AICommandCenter.scanProduct(req.params.productId); res.json({ ok: true, ...result }); }
  catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// POST /api/ai-cc/resolve/:issueId - Issue çöz
router.post('/resolve/:issueId', requireAuth, async (req, res) => {
  try { const result = await AICommandCenter.resolveIssue(req.params.issueId); res.json({ ok: true, ...result }); }
  catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

export default router;
