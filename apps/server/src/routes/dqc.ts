import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import { analyzeProduct, bulkAnalyze } from '../services/dqcEngine.ts';

const router = Router();

router.get('/analyze/:productId', requireAuth, async (req: Request, res: Response) => {
  try { res.json(await analyzeProduct(req.params.productId)); }
  catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

router.post('/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productIds, allProducts, xmlSourceId } = req.body;
    let ids = productIds;
    if (allProducts || xmlSourceId) {
      const products = await prisma.product.findMany({ where: xmlSourceId ? { xmlSourceId } : {}, select: { id: true } });
      ids = products.map(p => p.id);
    }
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productIds required' } });
    const result = await bulkAnalyze(ids);
    res.json(result);
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

router.get('/report', requireAuth, async (_req: Request, res: Response) => {
  try {
    const total = await prisma.product.count();
    const withCategory = await prisma.product.count({ where: { categoryMatch: true } });
    const withBrand = await prisma.product.count({ where: { brandMatch: true } });
    const withVariant = await prisma.product.count({ where: { variantMatch: true } });
    const withTitle = await prisma.product.count({ where: { computedTitle: { not: null } } });
    const withSeo = await prisma.product.count({ where: { seoTitle: { not: null } } });
    const withImage = await prisma.product.count({ where: { images: { not: null } } });
    const withBarcode = await prisma.product.count({ where: { barcode: { not: null } } });
    const withPrice = await prisma.product.count({ where: { salePrice: { gt: 0 } } });
    const withStock = await prisma.product.count({ where: { stock: { gt: 0 } } });

    res.json({ total, checks: { category: withCategory, brand: withBrand, variant: withVariant, title: withTitle, seo: withSeo, image: withImage, barcode: withBarcode, price: withPrice, stock: withStock }, passRate: total > 0 ? Math.round((withCategory + withBrand + withVariant + withTitle + withSeo + withImage + withBarcode + withPrice + withStock) / (total * 9) * 100) : 0 });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Rapor alınamadı' } }); }
});

router.get('/threshold', requireAuth, async (_req: Request, res: Response) => {
  const setting = await prisma.setting.findUnique({ where: { key: 'dqc_threshold' } });
  res.json({ threshold: Number(setting?.value || 80) });
});

router.put('/threshold', requireAuth, async (req: Request, res: Response) => {
  const { threshold } = req.body;
  await prisma.setting.upsert({ where: { key: 'dqc_threshold' }, update: { value: String(threshold) }, create: { key: 'dqc_threshold', value: String(threshold) } });
  res.json({ threshold });
});

export default router;
