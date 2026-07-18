import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/authMiddleware.ts';
import {
  createRule, updateRule, deleteRule, getRules,
  getProductPrice, bulkList, getListingLogs, previewPrice,
} from '../services/listingEngineV2/index.ts';

const router = Router();

// Debug route
router.all('/debug', (_req: any, res: any) => {
  res.json({ ok: true, message: 'listingV2 router is alive' });
});

// Hata yönetimi yardımcısı - custom statusCode destekler
function handleRouteError(res: any, e: any) {
  const statusCode = e.statusCode || 500;
  res.status(statusCode).json({ error: e.message || String(e) });
}

// Kural CRUD
router.get('/rules', requireAuth, async (req: any, res: any) => {
  try {
    const rules = await getRules(req.query.marketplaceId as string);
    res.json({ items: rules });
  } catch (e) { handleRouteError(res, e); }
});

router.post('/rules', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: any, res: any) => {
  try {
    const rule = await createRule(req.body);
    res.status(201).json({ item: rule });
  } catch (e) { handleRouteError(res, e); }
});

router.put('/rules/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: any, res: any) => {
  try {
    const rule = await updateRule(req.params.id, req.body);
    res.json({ item: rule });
  } catch (e) { handleRouteError(res, e); }
});

router.delete('/rules/:id', requireAuth, requireRole(['ADMIN']), async (req: any, res: any) => {
  try {
    await deleteRule(req.params.id);
    res.json({ ok: true });
  } catch (e) { handleRouteError(res, e); }
});

// Fiyat hesaplama
router.post('/calculate', requireAuth, async (req: any, res: any) => {
  try {
    const { purchasePrice, vatRate, profitMargin, rounding, applyVat } = req.body;
    const result = previewPrice(
      Number(purchasePrice), Number(vatRate),
      Number(profitMargin), rounding, applyVat !== false
    );
    res.json(result);
  } catch (e) { handleRouteError(res, e); }
});

// Ürün fiyatı - HİÇBİR ZAMAN 404 dönmez, her durumda PriceCalculation döndürür
router.get('/price/:productId/:marketplaceId', requireAuth, async (req: any, res: any) => {
  try {
    const result = await getProductPrice(req.params.productId, req.params.marketplaceId);
    res.json(result);
  } catch (e) { handleRouteError(res, e); }
});

// Toplu listeleme
router.post('/bulk-list', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: any, res: any) => {
  try {
    const { marketplaceId, productIds } = req.body;
    if (!marketplaceId || !productIds?.length) {
      return res.status(400).json({ error: 'marketplaceId ve productIds gerekli' });
    }
    const result = await bulkList(marketplaceId, productIds);
    res.json(result);
  } catch (e) { handleRouteError(res, e); }
});

// Loglar
router.get('/logs', requireAuth, async (req: any, res: any) => {
  try {
    const logs = await getListingLogs(req.query.marketplaceId as string, Number(req.query.limit) || 100);
    res.json({ items: logs });
  } catch (e) { handleRouteError(res, e); }
});

export default router;
