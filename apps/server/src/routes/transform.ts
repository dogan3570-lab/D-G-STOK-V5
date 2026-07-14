import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import {
  transformProduct, bulkTransform, undoTransform,
  cleanProductTitle, removeDuplicateBrand, removeBrandFromTitle,
  validateProduct,
} from '../services/transformationEngine.ts';

const router = Router();

// POST /transform/preview - Tek ürün dönüşüm önizleme
router.post('/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productId, policyType, cleanTitle, removeXmlBrand, dgBrandId } = req.body;
    if (!productId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productId required' } });
    const result = await transformProduct({ productId, policyType, cleanTitle, removeXmlBrand, dgBrandId }, (req as AuthedRequest).actor?.userId);
    res.json(result);
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

// POST /transform/apply - Dönüşümü uygula
router.post('/apply', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productId, policyType, cleanTitle, removeXmlBrand, dgBrandId } = req.body;
    if (!productId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productId required' } });
    const result = await transformProduct({ productId, policyType, cleanTitle, removeXmlBrand, dgBrandId }, (req as AuthedRequest).actor?.userId);
    await prisma.product.update({ where: { id: productId }, data: { originalTitle: result.originalTitle, computedTitle: result.transformedTitle, brandUsageType: policyType && policyType > 1 ? 'DG_BRAND' : 'XML_BRAND' } });
    await prisma.transformationLog.create({ data: { productId, action: 'TRANSFORM', oldTitle: result.originalTitle, newTitle: result.transformedTitle, oldBrand: result.originalBrand, newBrand: result.transformedBrand, stepType: 'BRAND', details: JSON.stringify({ changes: result.changes }), actorUserId: (req as AuthedRequest).actor?.userId } });
    res.json({ ok: true, ...result });
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

// POST /transform/bulk - Toplu dönüşüm
router.post('/bulk', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds, allProducts, xmlSourceId, policyType, cleanTitle, removeXmlBrand, dgBrandId } = req.body;
    let ids = productIds;
    if (allProducts || xmlSourceId) {
      const products = await prisma.product.findMany({ where: xmlSourceId ? { xmlSourceId } : {}, select: { id: true } });
      ids = products.map(p => p.id);
    }
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productIds array required' } });
    const result = await bulkTransform(ids, { policyType, cleanTitle, removeXmlBrand, dgBrandId }, (req as AuthedRequest).actor?.userId);
    res.json(result);
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

// POST /transform/clean - Ürün adı temizleme
router.post('/clean', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'title required' } });
    const cleaned = cleanProductTitle(title);
    const noDup = removeDuplicateBrand(cleaned, req.body.brandName || '');
    res.json({ original: title, cleaned, noDuplicateBrand: noDup, changes: title !== cleaned ? ['Temizlendi'] : [] });
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

// POST /transform/remove-brand - Markayı ürün adından kaldır
router.post('/remove-brand', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, brandName } = req.body;
    if (!title || !brandName) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'title and brandName required' } });
    const result = removeBrandFromTitle(title, brandName);
    res.json({ original: title, result, changed: title !== result });
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

// POST /transform/validate - Dönüşüm öncesi validasyon
router.post('/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productId required' } });
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });
    const validation = validateProduct(product);
    res.json({ productId, ...validation });
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

// POST /transform/undo/:logId - Dönüşümü geri al
router.post('/undo/:logId', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const result = await undoTransform(req.params.logId, (req as AuthedRequest).actor?.userId);
    res.json(result);
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

// GET /transform/logs - Dönüşüm logları
router.get('/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const [items, total] = await Promise.all([
      prisma.transformationLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.transformationLog.count(),
    ]);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Loglar alınamadı' } }); }
});

export default router;
