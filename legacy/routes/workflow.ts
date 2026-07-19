import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { calculateReadiness, getReadinessColor, getStatusFromScore, refreshWorkflowForProduct, seedWorkflowStates } from '../services/workflowEngine.ts';

const router = Router();

// GET /workflow/stats - Workflow istatistikleri
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [total, ready, needsReview, hasIssues, cannotSend, totalErrors] = await Promise.all([
      prisma.workflowState.count(),
      prisma.workflowState.count({ where: { status: 'READY' } }),
      prisma.workflowState.count({ where: { status: 'NEEDS_REVIEW' } }),
      prisma.workflowState.count({ where: { status: 'HAS_ISSUES' } }),
      prisma.workflowState.count({ where: { status: 'CANNOT_SEND' } }),
      prisma.workflowState.aggregate({ _sum: { errorCount: true } }),
    ]);

    // Hata merkezi
    const missingCategory = await prisma.product.count({ where: { categoryMatch: false } });
    const missingBrand = await prisma.product.count({ where: { brandMatch: false } });
    const missingVariant = await prisma.product.count({ where: { variantMatch: false } });
    const missingTitle = await prisma.product.count({ where: { computedTitle: null } });
    const missingSeo = await prisma.product.count({ where: { seoTitle: null, seoDescription: null } });
    const missingImage = await prisma.product.count({ where: { images: null } });
    const missingBarcode = await prisma.product.count({ where: { barcode: null } });
    const missingPrice = await prisma.product.count({ where: { salePrice: null } });
    const missingStock = await prisma.product.count({ where: { stock: { lte: 0 } } });

    res.json({
      total, ready, needsReview, hasIssues, cannotSend,
      totalErrors: totalErrors._sum.errorCount || 0,
      errors: {
        missingCategory, missingBrand, missingVariant, missingTitle,
        missingSeo, missingImage, missingBarcode, missingPrice, missingStock,
      },
      avgReadiness: total > 0 ? Math.round((ready * 100 + needsReview * 85 + hasIssues * 55 + cannotSend * 25) / total) : 0,
    });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'İstatistikler alınamadı' } }); }
});

// GET /workflow/products - Ürün listesi + workflow
router.get('/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const status = req.query.status ? String(req.query.status) : null;
    const search = String(req.query?.search ?? '').trim();

    const where: any = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.workflowState.findMany({
        where,
        orderBy: { readiness: 'asc' },
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.workflowState.count({ where }),
    ]);

    // Ürün bilgilerini ekle
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true, xmlKey: true, images: true, salePrice: true, stock: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const result = items.map(w => ({
      ...w,
      product: productMap.get(w.productId) || null,
      readinessColor: getReadinessColor(w.readiness),
      readinessLabel: w.readiness >= 100 ? 'Hazır' : w.readiness >= 80 ? 'Kontrol Edilmeli' : w.readiness >= 60 ? 'Eksikler Var' : w.readiness >= 40 ? 'Gönderilemez' : 'Kritik',
    }));

    res.json({ items: result, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Ürünler alınamadı' } }); }
});

// GET /workflow/product/:id - Tek ürün workflow detayı
router.get('/product/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const wf = await prisma.workflowState.findUnique({ where: { productId: req.params.id } });
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    const timeline = await prisma.workflowTimeline.findMany({
      where: { productId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ workflow: wf, product, timeline });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Detay alınamadı' } }); }
});

// POST /workflow/refresh - Tüm ürünlerin readiness'ini yeniden hesapla
router.post('/refresh', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const count = await seedWorkflowStates();
    res.json({ refreshedCount: count, message: `${count} ürün workflow durumu güncellendi` });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Yenileme başarısız' } }); }
});

// POST /workflow/timeline - Timeline event ekle
router.post('/timeline', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productId, event, details } = req.body;
    if (!productId || !event) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productId ve event zorunludur' } });
    const item = await prisma.workflowTimeline.create({
      data: { productId, event, details: details ? JSON.stringify(details) : null, actorUserId: (req as AuthedRequest).actor?.userId },
    });
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Olay eklenemedi' } }); }
});

export default router;
