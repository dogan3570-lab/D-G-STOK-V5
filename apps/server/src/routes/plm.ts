import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, type AuthedRequest } from '../auth/authMiddleware.ts';
import { WorkflowStateManager } from '../services/workflow/WorkflowStateManager.ts';

const router = Router();

const LIFECYCLE_STAGES = [
  'XML_GELDI', 'IC_AKTARILDI', 'URUN_HAVUZU', 'AI_ANALIZ',
  'KATEGORI_BEKLIYOR', 'KATEGORI_TAMAM', 'MARKA_BEKLIYOR', 'MARKA_TAMAM',
  'VARYANT_BEKLIYOR', 'VARYANT_TAMAM', 'ATTRIBUTE_BEKLIYOR', 'ATTRIBUTE_TAMAM',
  'BASLIK_OLUSTURULDU', 'SEO_OLUSTURULDU', 'RULES_KONTROL', 'VALIDATION',
  'LISTELEMEYE_HAZIR', 'GONDERIM_KUYRUGU', 'GONDERILIYOR', 'YAYINDA',
  'STOK_GUNCELLENIYOR', 'FIYAT_GUNCELLENIYOR', 'PASIF', 'ARSIV',
];

// GET /plm/product/:id - PLM detayı
router.get('/product/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { brand: true, category: true },
    });
    if (!product) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });

    const { score, steps } = await WorkflowStateManager.calculateReadiness(product.id);
    const history = await prisma.productHistory.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Hangi aşamada olduğunu belirle
    let currentStage = 'XML_GELDI';
    if (product.categoryMatch) currentStage = 'KATEGORI_TAMAM';
    if (product.brandMatch) currentStage = 'MARKA_TAMAM';
    if (product.variantMatch) currentStage = 'VARYANT_TAMAM';
    if (product.computedTitle) currentStage = 'BASLIK_OLUSTURULDU';
    if (product.seoTitle) currentStage = 'SEO_OLUSTURULDU';
    if (score >= 100) currentStage = 'LISTELEMEYE_HAZIR';
    if (product.status === 'PASSIVE') currentStage = 'PASIF';

    // Timeline verisi
    const stages = LIFECYCLE_STAGES.map(stage => ({
      stage,
      status: history.some(h => h.action === stage) ? 'completed' : 
              stage === currentStage ? 'active' : 'pending',
      completedAt: history.find(h => h.action === stage)?.createdAt || null,
    }));

    res.json({
      product: { id: product.id, title: product.title, xmlKey: product.xmlKey, status: product.status },
      healthScore: score,
      healthSteps: steps,
      currentStage,
      stages,
      history,
    });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'PLM detayı alınamadı' } }); }
});

// GET /plm/product/:id/history - Ürün geçmişi
router.get('/product/:id/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const items = await prisma.productHistory.findMany({
      where: { productId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Geçmiş alınamadı' } }); }
});

// POST /plm/product/:id/rollback/:historyId - Rollback
router.post('/product/:id/rollback/:historyId', requireAuth, async (req: Request, res: Response) => {
  try {
    const history = await prisma.productHistory.findUnique({ where: { id: req.params.historyId } });
    if (!history || history.productId !== req.params.id) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'History not found' } });

    const updateData: Record<string, unknown> = {};
    if (history.field === 'title') updateData.title = history.oldValue;
    if (history.field === 'brandId') { updateData.brandId = history.oldValue || null; updateData.brandMatch = !!history.oldValue; }
    if (history.field === 'categoryId') { updateData.categoryId = history.oldValue || null; updateData.categoryMatch = !!history.oldValue; }
    if (history.field === 'salePrice') updateData.salePrice = history.oldValue ? Number(history.oldValue) : null;
    if (history.field === 'stock') updateData.stock = Number(history.oldValue || 0);

    if (Object.keys(updateData).length > 0) {
      await prisma.product.update({ where: { id: req.params.id }, data: updateData });
    }

    await prisma.productHistory.create({
      data: {
        productId: req.params.id, field: history.field,
        oldValue: history.newValue, newValue: history.oldValue,
        action: 'ROLLBACK', actorUserId: (req as AuthedRequest).actor?.userId,
      },
    });

    res.json({ ok: true, message: 'Rollback başarılı' });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Rollback başarısız' } }); }
});

// GET /plm/health - Sağlık skoru istatistikleri
router.get('/health', requireAuth, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.workflowState.findMany({ select: { readiness: true }, take: 10000 });
    const distribution = { excellent: 0, ready: 0, review: 0, issues: 0, critical: 0 };
    for (const i of items) {
      if (i.readiness >= 100) distribution.excellent++;
      else if (i.readiness >= 90) distribution.ready++;
      else if (i.readiness >= 80) distribution.review++;
      else if (i.readiness >= 60) distribution.issues++;
      else distribution.critical++;
    }
    const avg = items.length > 0 ? Math.round(items.reduce((s, i) => s + i.readiness, 0) / items.length) : 0;
    res.json({ distribution, average: avg, total: items.length });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sağlık verisi alınamadı' } }); }
});

// POST /plm/history - History kaydı ekle
router.post('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productId, field, oldValue, newValue, action } = req.body;
    const item = await prisma.productHistory.create({
      data: { productId, field, oldValue: String(oldValue ?? ''), newValue: String(newValue ?? ''), action, actorUserId: (req as AuthedRequest).actor?.userId },
    });
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kayıt eklenemedi' } }); }
});

export default router;
