import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { aiSuggest, aiLearn } from '../services/aiEngine.ts';

const router = Router();

router.get('/suggest/:module/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await aiSuggest(req.params.module.toUpperCase(), req.params.productId);
    res.json(result);
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

router.post('/accept/:logId', requireAuth, async (req: Request, res: Response) => {
  try {
    const log = await prisma.aIDecisionLog.update({ where: { id: req.params.logId }, data: { accepted: true } });
    await aiLearn(log.module, log.suggestion, log.suggestion, true);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kabul edilemedi' } }); }
});

router.post('/reject/:logId', requireAuth, async (req: Request, res: Response) => {
  try {
    const log = await prisma.aIDecisionLog.update({ where: { id: req.params.logId }, data: { accepted: false } });
    await aiLearn(log.module, log.suggestion, log.suggestion, false);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Reddedilemedi' } }); }
});

router.post('/learn', requireAuth, async (req: Request, res: Response) => {
  try {
    const { module, input, output, accepted } = req.body;
    await aiLearn(module.toUpperCase(), input, output, accepted);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Öğrenilemedi' } }); }
});

router.get('/knowledge', requireAuth, async (req: Request, res: Response) => {
  try {
    const module = req.query.module ? String(req.query.module).toUpperCase() : undefined;
    const where = module ? { module } : {};
    const items = await prisma.aIKnowledge.findMany({ where, orderBy: { useCount: 'desc' }, take: 100 });
    res.json({ items });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Bilgi alınamadı' } }); }
});

router.get('/policy', requireAuth, async (_req: Request, res: Response) => {
  try {
    let policies = await prisma.aIUserPolicy.findMany();
    if (policies.length === 0) {
      const defaults = ['CATEGORY', 'BRAND', 'TITLE', 'SEO', 'ATTRIBUTE', 'VARIANT'];
      for (const m of defaults) await prisma.aIUserPolicy.create({ data: { module: m, autoApplyThreshold: m === 'SEO' ? 100 : 95, requireApproval: m !== 'SEO' } });
      policies = await prisma.aIUserPolicy.findMany();
    }
    res.json({ items: policies });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Politikalar alınamadı' } }); }
});

router.put('/policy/:module', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { autoApplyThreshold, requireApproval } = req.body;
    const policy = await prisma.aIUserPolicy.upsert({
      where: { module: req.params.module.toUpperCase() },
      update: { autoApplyThreshold: autoApplyThreshold ?? 95, requireApproval: requireApproval ?? true },
      create: { module: req.params.module.toUpperCase(), autoApplyThreshold: autoApplyThreshold ?? 95, requireApproval: requireApproval ?? true },
    });
    res.json(policy);
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Politika güncellenemedi' } }); }
});

router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [totalKnowledge, totalDecisions, acceptedCount, rejectedCount] = await Promise.all([
      prisma.aIKnowledge.count(),
      prisma.aIDecisionLog.count(),
      prisma.aIDecisionLog.count({ where: { accepted: true } }),
      prisma.aIDecisionLog.count({ where: { accepted: false } }),
    ]);
    res.json({ totalKnowledge, totalDecisions, acceptedCount, rejectedCount, acceptRate: totalDecisions > 0 ? Math.round(acceptedCount / totalDecisions * 100) : 0 });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'İstatistikler alınamadı' } }); }
});

export default router;
