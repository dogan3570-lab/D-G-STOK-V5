import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import { calculateReadiness } from '../services/workflowEngine.ts';
import { analyzeProduct } from '../services/dqcEngine.ts';

const router = Router();

router.get('/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.productId },
      include: { brand: true, category: true, xmlSource: true, variants: true },
    });
    if (!product) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });

    const workflow = await calculateReadiness(product);
    const quality = await analyzeProduct(product.id);
    const timeline = await prisma.workflowTimeline.findMany({ where: { productId: product.id }, orderBy: { createdAt: 'desc' }, take: 20 });
    const history = await prisma.productHistory.findMany({ where: { productId: product.id }, orderBy: { createdAt: 'desc' }, take: 10 });
    const logs = await prisma.transformationLog.findMany({ where: { productId: product.id }, orderBy: { createdAt: 'desc' }, take: 10 });

    // PLM stage
    let currentStage = 'XML_GELDI';
    if (product.categoryMatch) currentStage = 'KATEGORI_TAMAM';
    if (product.brandMatch) currentStage = 'MARKA_TAMAM';
    if (product.variantMatch) currentStage = 'VARYANT_TAMAM';
    if (product.computedTitle) currentStage = 'BASLIK_OLUSTURULDU';
    if (workflow.score >= 100) currentStage = 'LISTELEMEYE_HAZIR';

    res.json({
      id: product.id,
      xmlKey: product.xmlKey,
      title: product.title,
      originalTitle: product.originalTitle,
      computedTitle: product.computedTitle,
      sku: product.sku,
      barcode: product.barcode,
      stock: product.stock,
      salePrice: product.salePrice,
      currency: product.currency,
      status: product.status,
      brand: product.brand?.name || null,
      category: product.category?.name || null,
      xmlSource: product.xmlSource?.name || null,
      scores: {
        health: workflow.score,
        quality: quality.score,
      },
      plm: {
        currentStage,
        healthScore: workflow.score,
        healthSteps: workflow.steps,
      },
      dqc: {
        score: quality.score,
        label: quality.label,
        checks: quality.checks,
      },
      timeline,
      history,
      transformations: logs,
    });
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

export default router;
