import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';

const router = Router();

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const s1 = a.toLowerCase().trim(), s2 = b.toLowerCase().trim();
  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 85;
  const dist = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen > 0 ? Math.round((1 - dist / maxLen) * 100) : 0;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

// GET /mdm/duplicates/barcode - Aynı barkoda sahip ürünler
router.get('/duplicates/barcode', requireAuth, async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({ where: { barcode: { not: null } }, select: { id: true, title: true, barcode: true, sku: true, brand: { select: { name: true } } } });
    const barcodeMap = new Map<string, typeof products>();
    for (const p of products) {
      if (!p.barcode) continue;
      const arr = barcodeMap.get(p.barcode) || [];
      arr.push(p); barcodeMap.set(p.barcode, arr);
    }
    const duplicates = Array.from(barcodeMap.entries()).filter(([, arr]) => arr.length > 1).map(([barcode, items]) => ({ barcode, count: items.length, items }));
    res.json({ totalDuplicates: duplicates.length, items: duplicates });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kontrol başarısız' } }); }
});

// POST /mdm/merge - Ürün birleştir
router.post('/merge', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { keepId, mergeId } = req.body;
    if (!keepId || !mergeId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'keepId ve mergeId required' } });
    // Silinecek ürünün ilişkilerini korunacak ürüne taşı
    await prisma.variant.updateMany({ where: { productId: mergeId }, data: { productId: keepId } });
    await prisma.productMarketplaceState.updateMany({ where: { productId: mergeId }, data: { productId: keepId } });
    await prisma.product.delete({ where: { id: mergeId } });
    res.json({ ok: true, message: 'Ürünler birleştirildi' });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Birleştirme başarısız' } }); }
});

// GET /mdm/similar/:productId - Benzer ürünler
router.get('/similar/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!product) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    const all = await prisma.product.findMany({ where: { id: { not: product.id }, barcode: { not: null } }, select: { id: true, title: true, barcode: true, sku: true, brand: { select: { name: true } } }, take: 1000 });
    const similar = all.map(p => ({ ...p, similarity: Math.max(similarity(p.title || '', product.title || ''), p.barcode === product.barcode ? 100 : 0) })).filter(p => p.similarity > 60).sort((a, b) => b.similarity - a.similarity).slice(0, 20);
    res.json({ items: similar });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Arama başarısız' } }); }
});

export default router;
