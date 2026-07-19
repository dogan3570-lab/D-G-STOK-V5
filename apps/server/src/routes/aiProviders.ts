// ==================== AI PROVIDER ROUTES ====================
// DG STOK V5.0
// =============================================================

import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { prisma } from '../db/prisma.ts';
import { AIProviderManager } from '../services/ai/AIProviderManager.ts';

const router = Router();

// GET /api/ai/providers - Tüm provider'lar
router.get('/providers', requireAuth, async (_req, res) => {
  try {
    const providers = await prisma.aIProvider.findMany({ orderBy: { priority: 'asc' } });
    res.json({ ok: true, items: providers });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// POST /api/ai/provider/test - Provider test
router.post('/provider/test', requireAuth, async (req, res) => {
  try {
    const { providerId } = req.body;
    const provider = await prisma.aIProvider.findUnique({ where: { id: providerId } });
    if (!provider) return res.status(404).json({ ok: false, error: 'Provider bulunamadı' });
    
    const result = await AIProviderManager.sendRequest({ prompt: 'test', module: 'category' });
    res.json({ ok: true, data: result });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// POST /api/ai/provider/enable
router.post('/provider/enable', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { providerId } = req.body;
    await prisma.aIProvider.update({ where: { id: providerId }, data: { enabled: true } });
    res.json({ ok: true });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// POST /api/ai/provider/disable
router.post('/provider/disable', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { providerId } = req.body;
    await prisma.aIProvider.update({ where: { id: providerId }, data: { enabled: false } });
    res.json({ ok: true });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// GET /api/ai/provider/health
router.get('/provider/health', requireAuth, async (_req, res) => {
  try {
    const providers = await prisma.aIProvider.findMany({ select: { id: true, name: true, enabled: true, status: true, lastCheck: true } });
    res.json({ ok: true, items: providers });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// GET /api/ai/provider/cost - Maliyet dashboard
router.get('/provider/cost', requireAuth, async (_req, res) => {
  try {
    const stats = await AIProviderManager.getDashboard();
    res.json({ ok: true, ...stats });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

// GET /api/ai/provider/logs - İstek logları
router.get('/provider/logs', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const [items, total] = await Promise.all([
      prisma.aIRequestLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.aIRequestLog.count(),
    ]);
    res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) { res.status(500).json({ ok: false, error: error.message }); }
});

export default router;
