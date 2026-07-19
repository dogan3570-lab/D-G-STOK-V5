import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { EventBus } from '../services/eventBus/EventBus.ts';
import { createCorrelationId } from '../services/eventBus/events.ts';
import { matchBrand } from '../services/aiEngine.ts';

const router = Router();

// ==================== HELPERS ====================

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

function normalizeBrandName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function createBrandLog(params: {
  action: string; xmlBrandName?: string; dgBrandId?: string; dgBrandName?: string;
  oldValue?: string; newValue?: string; prefixChanged?: boolean;
  productCount?: number; details?: string; actorUserId?: string;
}) {
  await prisma.brandLog.create({ data: params as any });
}

function applyPrefixFormat(format: string, brandName: string, title: string): string {
  return format.replace(/\{title\}/g, title).replace(/MARKA/g, brandName);
}

// ==================== XML BRANDS ====================

router.get('/xml-brands', requireAuth, async (req: Request, res: Response) => {
  try {
    const xmlSourceId = req.query.xmlSourceId ? String(req.query.xmlSourceId) : null;
    const search = String(req.query?.search ?? '').trim();
    const where: any = { brandId: { not: null } };
    if (xmlSourceId) where.xmlSourceId = xmlSourceId;
    if (search) where.brand = { name: { contains: search } };
    const products = await prisma.product.findMany({ where, select: { brand: { select: { name: true } }, xmlSourceId: true, xmlSource: { select: { name: true } } }, distinct: ['brandId'] });
    const items = products.filter(p => p.brand?.name).map(p => ({ name: p.brand!.name, sourceName: p.xmlSource?.name || 'Bilinmeyen', sourceId: p.xmlSourceId }));
    res.json({ items });
  } catch (error) { console.error('[brands] GET xml-brands error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: 'XML markaları alınamadı' } }); }
});

// ==================== STATS ====================

router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [totalSystemBrands, matchedProducts, unmatchedProducts, totalMappings, totalLogs] = await Promise.all([
      prisma.brand.count({ where: { isActive: true } }), prisma.product.count({ where: { brandMatch: true } }),
      prisma.product.count({ where: { brandMatch: false } }), prisma.brandMapping.count(), prisma.brandLog.count(),
    ]);
    const brandUsageCounts = await prisma.product.groupBy({ by: ['brandUsageType'], _count: { brandUsageType: true } });
    const usageMap: Record<string, number> = {};
    for (const u of brandUsageCounts) usageMap[u.brandUsageType] = u._count.brandUsageType;
    res.json({ totalSystemBrands, matchedProducts, unmatchedProducts, totalMappings, totalLogs,
      xmlBrandUsage: usageMap['XML_BRAND'] || 0, dgBrandUsage: usageMap['DG_BRAND'] || 0, customBrandUsage: usageMap['CUSTOM'] || 0,
      prefixEnabledCount: await prisma.product.count({ where: { prefixEnabled: true } }) });
  } catch (error) { console.error('[brands] GET stats error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: 'İstatistikler alınamadı' } }); }
});

// ==================== BRAND PRODUCTS (for brand matching page) ====================
router.get('/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const limit = parseInt(String(req.query.limit || '50'));
    const search = String(req.query.search || '').trim();
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : null;
    const unbranded = req.query?.unbranded === 'true';
    const brandIdParam = req.query?.brandId ? String(req.query.brandId) : null;
    
    const where: any = {};
    if (unbranded) where.brandMatch = false;
    if (brandIdParam === 'not_null') where.brandId = { not: null };
    else if (brandIdParam) where.brandId = brandIdParam;
    if (search) where.OR = [{ title: { contains: search } }, { xmlKey: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }];
    if (xmlSourceId) where.xmlSourceId = xmlSourceId;
    
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          xmlSource: { select: { id: true, name: true } },
          variants: { select: { id: true, name: true, value: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('[brands] GET products error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch brand products' } });
  }
});

// ==================== SYSTEM BRANDS ====================

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const where: Record<string, unknown> = {};
    if (search) where.name = { contains: search };
    const brands = await prisma.brand.findMany({ where, orderBy: { name: 'asc' }, include: { _count: { select: { products: true, brandMappings: true } } } });
    res.json({ items: brands.map(b => ({ id: b.id, name: b.name, externalId: b.externalId, logo: b.logo, prefixEnabled: b.prefixEnabled, prefixFormat: b.prefixFormat, isActive: b.isActive, productCount: b._count.products, mappingCount: b._count.brandMappings, createdAt: b.createdAt, updatedAt: b.updatedAt })) });
  } catch (error) { console.error('[brands] GET error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: 'Markalar alınamadı' } }); }
});

// ==================== MAPPINGS ====================

router.get('/mappings', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const dgBrandId = req.query?.dgBrandId ? String(req.query.dgBrandId) : null;
    const where: Record<string, unknown> = {};
    if (search) where.xmlBrandName = { contains: search };
    if (dgBrandId) where.dgBrandId = dgBrandId;
    const mappings = await prisma.brandMapping.findMany({ where, orderBy: { createdAt: 'desc' }, include: { dgBrand: { select: { id: true, name: true, logo: true } } } });
    res.json({ items: mappings.map(m => ({ id: m.id, xmlBrandName: m.xmlBrandName, dgBrandId: m.dgBrandId, dgBrandName: m.dgBrand.name, dgBrandLogo: m.dgBrand.logo, confidence: m.confidence, isAuto: m.isAuto, productCount: m.productCount, createdAt: m.createdAt })) });
  } catch (error) { console.error('[brands] GET mappings error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: 'Eşleştirmeler alınamadı' } }); }
});

// ==================== LOGS ====================

router.get('/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const [items, total] = await Promise.all([
      prisma.brandLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.brandLog.count(),
    ]);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { console.error('[brands] GET logs error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: 'Loglar alınamadı' } }); }
});

// ==================== CRUD ====================

router.post('/', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { name, externalId, logo, prefixEnabled, prefixFormat } = req.body;
    if (!name) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name is required' } });
    const brand = await prisma.brand.create({ data: { name, externalId: externalId || null, logo: logo || null, prefixEnabled: prefixEnabled || false, prefixFormat: prefixFormat || 'MARKA\u00ae {title}' } });
    await createBrandLog({ action: 'BRAND_CREATE', dgBrandId: brand.id, dgBrandName: brand.name, actorUserId: (req as AuthedRequest).actor?.userId });
    res.status(201).json({ item: brand });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Marka oluşturulamadı' } }); }
});

router.put('/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, externalId, logo, prefixEnabled, prefixFormat, isActive } = req.body;
    const old = await prisma.brand.findUnique({ where: { id } });
    if (!old) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Marka bulunamadı' } });
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name; if (externalId !== undefined) data.externalId = externalId || null;
    if (logo !== undefined) data.logo = logo || null; if (prefixEnabled !== undefined) data.prefixEnabled = prefixEnabled;
    if (prefixFormat !== undefined) data.prefixFormat = prefixFormat; if (isActive !== undefined) data.isActive = isActive;
    const brand = await prisma.brand.update({ where: { id }, data });
    await createBrandLog({ action: 'BRAND_UPDATE', dgBrandId: id, dgBrandName: brand.name, oldValue: old.name, newValue: brand.name, details: JSON.stringify({ prefixChanged: old.prefixEnabled !== brand.prefixEnabled || old.prefixFormat !== brand.prefixFormat }), actorUserId: (req as AuthedRequest).actor?.userId });
    res.json({ item: brand });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Marka güncellenemedi' } }); }
});

router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Marka bulunamadı' } });
    await prisma.product.updateMany({ where: { brandId: id }, data: { brandId: null, brandMatch: false } });
    await prisma.brandMapping.deleteMany({ where: { dgBrandId: id } });
    await prisma.brand.delete({ where: { id } });
    await createBrandLog({ action: 'BRAND_DELETE', dgBrandId: id, dgBrandName: brand.name, actorUserId: (req as AuthedRequest).actor?.userId });
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Marka silinemedi' } }); }
});

// ==================== MATCH / UNMATCH ====================

router.post('/match', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { xmlBrandName, dgBrandId, productIds } = req.body;
    if (!xmlBrandName || !dgBrandId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'xmlBrandName ve dgBrandId zorunludur' } });
    const dgBrand = await prisma.brand.findUnique({ where: { id: dgBrandId } });
    if (!dgBrand) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'DG STOK markas\u0131 bulunamad\u0131' } });
    await prisma.brandMapping.upsert({ where: { xmlBrandName }, update: { dgBrandId, isAuto: false }, create: { xmlBrandName, dgBrandId, isAuto: false } });
    const where: any = {};
    if (Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds }; else where.brand = { name: xmlBrandName };
    const result = await prisma.product.updateMany({ where, data: { brandId: dgBrandId, brandMatch: true, matchedBy: 'manual', lastMatchDate: new Date(), brandUsageType: 'DG_BRAND' } });
    const productCount = await prisma.product.count({ where: { brandId: dgBrandId } });
    await prisma.brandMapping.update({ where: { xmlBrandName }, data: { productCount } });
    await createBrandLog({ action: 'BRAND_MATCH', xmlBrandName, dgBrandId, dgBrandName: dgBrand.name, productCount: result.count, actorUserId: (req as AuthedRequest).actor?.userId, details: JSON.stringify({ hasProductFilter: Array.isArray(productIds) }) });

    // EVENT: Marka eşleştirme değişikliğini yayınla
    if (result.count > 0) {
      const affectedProductIds = Array.isArray(productIds) && productIds.length > 0
        ? productIds
        : (await prisma.product.findMany({ where: { brandId: dgBrandId }, select: { id: true }, take: 10000 })).map(p => p.id);
      const correlationId = createCorrelationId('WF');
      await EventBus.emit({
        type: 'BrandMatchChanged',
        correlationId,
        timestamp: new Date().toISOString(),
        source: 'brands.match',
        data: {
          productIds: affectedProductIds,
          productCount: affectedProductIds.length,
          oldValue: false,
          newValue: true,
          source: 'manual',
          triggeredBy: (req as AuthedRequest).actor?.userId,
        },
      });
    }

    res.json({ matchedCount: result.count, message: `${result.count} \u00fcr\u00fcn "${dgBrand.name}" markas\u0131na e\u015fle\u015ftirildi` });
  } catch (error) { console.error('[brands] POST match error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: 'E\u015fle\u015ftirme ba\u015far\u0131s\u0131z' } }); }
});

router.post('/unmatch', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { xmlBrandName, productIds } = req.body;
    const where: any = {};
    if (Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };
    else if (xmlBrandName) where.brand = { name: xmlBrandName };
    else return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'xmlBrandName veya productIds zorunludur' } });
    const result = await prisma.product.updateMany({ where, data: { brandId: null, brandMatch: false, brandUsageType: 'XML_BRAND' } });
    await createBrandLog({ action: 'BRAND_UNMATCH', xmlBrandName, productCount: result.count, actorUserId: (req as AuthedRequest).actor?.userId });

    // EVENT: Marka eşleştirme kaldırma
    if (result.count > 0) {
      const affectedIds = Array.isArray(productIds) && productIds.length > 0
        ? productIds
        : (await prisma.product.findMany({ where, select: { id: true }, take: 10000 })).map(p => p.id);
      const correlationId = createCorrelationId('WF');
      await EventBus.emit({
        type: 'BrandMatchChanged',
        correlationId,
        timestamp: new Date().toISOString(),
        source: 'brands.unmatch',
        data: {
          productIds: affectedIds,
          productCount: affectedIds.length,
          oldValue: true,
          newValue: false,
          source: 'manual',
          triggeredBy: (req as AuthedRequest).actor?.userId,
        },
      });
    }

    res.json({ unmatchedCount: result.count, message: `${result.count} \u00fcr\u00fcn\u00fcn e\u015fle\u015ftirmesi kald\u0131r\u0131ld\u0131` });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'E\u015fle\u015ftirme kald\u0131r\u0131lamad\u0131' } }); }
});

router.post('/bulk-match', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { matches } = req.body;
    if (!Array.isArray(matches) || matches.length === 0) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'matches array required' } });
    let totalMatched = 0; const allProductIds: string[] = [];
    const results: Array<{ xmlBrandName: string; dgBrandName: string; count: number }> = [];
    for (const match of matches) {
      const { xmlBrandName, dgBrandId } = match;
      const dgBrand = await prisma.brand.findUnique({ where: { id: dgBrandId } });
      if (!dgBrand) continue;
      await prisma.brandMapping.upsert({ where: { xmlBrandName }, update: { dgBrandId, isAuto: false }, create: { xmlBrandName, dgBrandId, isAuto: false } });
      const result = await prisma.product.updateMany({ where: { brand: { name: xmlBrandName } }, data: { brandId: dgBrandId, brandMatch: true, matchedBy: 'bulk', lastMatchDate: new Date(), brandUsageType: 'DG_BRAND' } });
      const productCount = await prisma.product.count({ where: { brandId: dgBrandId } });
      await prisma.brandMapping.update({ where: { xmlBrandName }, data: { productCount } });
      totalMatched += result.count; results.push({ xmlBrandName, dgBrandName: dgBrand.name, count: result.count });
      const ids = (await prisma.product.findMany({ where: { brandId: dgBrandId }, select: { id: true }, take: 10000 })).map(p => p.id);
      allProductIds.push(...ids);
    }
    await createBrandLog({ action: 'BULK_CHANGE', productCount: totalMatched, details: JSON.stringify(results), actorUserId: (req as AuthedRequest).actor?.userId });

    // EVENT: Toplu marka eşleştirme
    if (allProductIds.length > 0) {
      const correlationId = createCorrelationId('WF');
      await EventBus.emit({
        type: 'BrandMatchChanged',
        correlationId,
        timestamp: new Date().toISOString(),
        source: 'brands.bulkMatch',
        data: {
          productIds: allProductIds,
          productCount: allProductIds.length,
          oldValue: false,
          newValue: true,
          source: 'bulk',
          triggeredBy: (req as AuthedRequest).actor?.userId,
        },
      });
    }

    res.json({ matchedCount: totalMatched, results, message: `${totalMatched} \u00fcr\u00fcn toplu e\u015fle\u015ftirildi` });
  } catch (error) { console.error('[brands] POST bulk-match error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: 'Toplu e\u015fle\u015ftirme ba\u015far\u0131s\u0131z' } }); }
});

// ==================== AI MATCH (V2 - AI ENGINE İLE) ====================

router.post('/ai-match', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;
    const where: any = { brandMatch: false };
    if (Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true, title: true, xmlKey: true, description: true, barcode: true,
        brand: { select: { id: true, name: true } },
        xmlSource: { select: { name: true } },
      },
    });
    const systemBrands = await prisma.brand.findMany({ where: { isActive: true } });

    let matchedCount = 0;
    let suggestedCount = 0;
    let manualCount = 0;
    const results: Array<{ productId: string; productName: string; currentBrand: string; suggestedBrand: string | null; confidence: number }> = [];
    const toUpdateMatch: Array<{ id: string; brandId: string; score: number }> = [];

    for (const product of products) {
      const result = await matchBrand(
        {
          id: product.id,
          title: product.title,
          xmlKey: product.xmlKey,
          xmlBrandName: product.brand?.name || null,
          description: product.description,
          barcode: product.barcode,
          supplierName: product.xmlSource?.name || null,
          currentBrandId: product.brand?.id || null,
        },
        systemBrands
      );

      results.push({
        productId: result.productId,
        productName: result.productName,
        currentBrand: product.brand?.name || '',
        suggestedBrand: result.suggestedBrand,
        confidence: result.confidence,
      });

      if (result.status === 'auto_matched' && result.suggestedBrandId) {
        toUpdateMatch.push({
          id: result.productId,
          brandId: result.suggestedBrandId,
          score: result.confidence,
        });
        matchedCount++;

        // BrandMapping öğrenme kaydı
        if (product.brand?.name) {
          try {
            await prisma.brandMapping.upsert({
              where: { xmlBrandName: product.brand.name },
              update: { dgBrandId: result.suggestedBrandId, confidence: result.confidence, isAuto: true },
              create: { xmlBrandName: product.brand.name, dgBrandId: result.suggestedBrandId, confidence: result.confidence, isAuto: true },
            });
          } catch {}
        }
      } else if (result.status === 'suggested') {
        suggestedCount++;
      } else if (result.status === 'manual_review') {
        manualCount++;
      }
    }

    // Toplu güncelleme
    for (const m of toUpdateMatch) {
      try {
        await prisma.product.update({
          where: { id: m.id },
          data: {
            brandId: m.brandId,
            brandMatch: true,
            matchedBy: 'ai',
            lastMatchDate: new Date(),
            brandUsageType: 'DG_BRAND',
          },
        });
      } catch {}
    }

    await createBrandLog({
      action: 'AI_MATCH',
      productCount: matchedCount,
      details: JSON.stringify({ matchedCount, suggestedCount, manualCount, totalScanned: products.length }),
      actorUserId: (req as AuthedRequest).actor?.userId,
    });

    // EVENT: AI marka eşleştirme
    if (matchedCount > 0) {
      const matchedProductIds = results.map(r => r.productId);
      const aiCorrelationId = createCorrelationId('WF');
      await EventBus.emit({
        type: 'BrandMatchChanged',
        correlationId: aiCorrelationId,
        timestamp: new Date().toISOString(),
        source: 'brands.aiMatch',
        data: {
          productIds: matchedProductIds,
          productCount: matchedProductIds.length,
          oldValue: false,
          newValue: true,
          source: 'ai',
          triggeredBy: (req as AuthedRequest).actor?.userId,
        },
      });
    }

    res.json({
      matchedCount,
      suggestedCount,
      manualCount,
      totalProducts: products.length,
      message: `${matchedCount} ürün AI ile eşleştirildi, ${suggestedCount} öneri, ${manualCount} manuel inceleme`,
      results,
    });
  } catch (error) {
    console.error('[brands] POST ai-match error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'AI eşleştirme başarısız' } });
  }
});

// ==================== PREFIX ====================

router.post('/prefix/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productIds, brandId, prefixFormat } = req.body;
    if (!productIds || !Array.isArray(productIds)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productIds array required' } });
    const brand = brandId ? await prisma.brand.findUnique({ where: { id: brandId } }) : null;
    const format = prefixFormat || brand?.prefixFormat || 'MARKA\u00ae {title}';
    const brandName = brand?.name || 'MARKA';
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true, originalTitle: true } });
    const previews = products.map(p => ({ id: p.id, originalTitle: p.originalTitle || p.title || '', computedTitle: applyPrefixFormat(format, brandName, p.originalTitle || p.title || '') }));
    res.json({ previews, count: previews.length, format, brandName });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: '\u00d6nizleme al\u0131namad\u0131' } }); }
});

router.post('/prefix/apply', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds, brandId, prefixFormat, allProducts } = req.body;
    const where: any = {};
    if (!allProducts) { if (Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds }; else return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productIds veya allProducts gereklidir' } }); }
    const brand = brandId ? await prisma.brand.findUnique({ where: { id: brandId } }) : null;
    const format = prefixFormat || brand?.prefixFormat || 'MARKA\u00ae {title}';
    const brandName = brand?.name || 'MARKA';
    const products = await prisma.product.findMany({ where, select: { id: true, title: true, originalTitle: true } });
    let updatedCount = 0;
    for (const p of products) {
      const orig = p.originalTitle || p.title || '';
      await prisma.product.update({ where: { id: p.id }, data: { originalTitle: orig, computedTitle: applyPrefixFormat(format, brandName, orig), prefixEnabled: true, title: applyPrefixFormat(format, brandName, orig) } });
      updatedCount++;
    }
    await createBrandLog({ action: 'PREFIX_APPLY', dgBrandId: brandId, dgBrandName: brandName, prefixChanged: true, productCount: updatedCount, details: JSON.stringify({ format, allProducts: !!allProducts }), actorUserId: (req as AuthedRequest).actor?.userId });
    res.json({ updatedCount, message: `${updatedCount} \u00fcr\u00fcne "${format}" format\u0131 uyguland\u0131` });
  } catch (error) { console.error('[brands] POST prefix/apply error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: '\u00d6n ek uygulanamad\u0131' } }); }
});

router.post('/prefix/remove', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds, allProducts } = req.body;
    const where: any = { prefixEnabled: true };
    if (!allProducts && Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };
    const products = await prisma.product.findMany({ where, select: { id: true, originalTitle: true, title: true } });
    let updatedCount = 0;
    for (const p of products) {
      const orig = p.originalTitle || p.title || '';
      await prisma.product.update({ where: { id: p.id }, data: { title: orig, computedTitle: null, prefixEnabled: false } });
      updatedCount++;
    }
    await createBrandLog({ action: 'PREFIX_REMOVE', prefixChanged: true, productCount: updatedCount, details: JSON.stringify({ allProducts: !!allProducts }), actorUserId: (req as AuthedRequest).actor?.userId });
    res.json({ updatedCount, message: `${updatedCount} \u00fcr\u00fcnden \u00f6n ek kald\u0131r\u0131ld\u0131` });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: '\u00d6n ek kald\u0131r\u0131lamad\u0131' } }); }
});

// ==================== USAGE TYPE ====================

router.post('/use-xml-brand', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds, allProducts } = req.body;
    const where: any = {};
    if (!allProducts && Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };
    const result = await prisma.product.updateMany({ where, data: { brandUsageType: 'XML_BRAND', brandMatch: false, brandId: null } });
    await createBrandLog({ action: 'BULK_CHANGE', productCount: result.count, details: JSON.stringify({ usageType: 'XML_BRAND', allProducts: !!allProducts }), actorUserId: (req as AuthedRequest).actor?.userId });
    res.json({ updatedCount: result.count, message: `${result.count} \u00fcr\u00fcn XML markas\u0131 kullanacak \u015fekilde ayarland\u0131` });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: '\u0130\u015flem ba\u015far\u0131s\u0131z' } }); }
});

router.post('/use-dg-brand', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds, allProducts } = req.body;
    const where: any = {};
    if (!allProducts && Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };
    const result = await prisma.product.updateMany({ where, data: { brandUsageType: 'DG_BRAND', brandMatch: true } });
    await createBrandLog({ action: 'BULK_CHANGE', productCount: result.count, details: JSON.stringify({ usageType: 'DG_BRAND', allProducts: !!allProducts }), actorUserId: (req as AuthedRequest).actor?.userId });
    res.json({ updatedCount: result.count, message: `${result.count} \u00fcr\u00fcn DG STOK markas\u0131 kullanacak \u015fekilde ayarland\u0131` });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: '\u0130\u015flem ba\u015far\u0131s\u0131z' } }); }
});

// ==================== EXPORT / IMPORT ====================

router.get('/export', requireAuth, async (_req: Request, res: Response) => {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    const mappings = await prisma.brandMapping.findMany({ include: { dgBrand: { select: { name: true } } } });
    res.json({ exportedAt: new Date().toISOString(), brands: brands.map(b => ({ name: b.name, logo: b.logo, prefixEnabled: b.prefixEnabled, prefixFormat: b.prefixFormat })), mappings: mappings.map(m => ({ xmlBrandName: m.xmlBrandName, dgBrandName: m.dgBrand.name, isAuto: m.isAuto })) });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'D\u0131\u015fa aktarma ba\u015far\u0131s\u0131z' } }); }
});

router.post('/import', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { brands, mappings } = req.body;
    if (!Array.isArray(brands) && !Array.isArray(mappings)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'brands veya mappings array gerekli' } });
    let brandCount = 0, mappingCount = 0;
    if (Array.isArray(brands)) for (const b of brands) { if (!b.name) continue; try { await prisma.brand.upsert({ where: { name: b.name }, update: { logo: b.logo || null, prefixEnabled: b.prefixEnabled || false, prefixFormat: b.prefixFormat || 'MARKA\u00ae {title}' }, create: { name: b.name, logo: b.logo || null, prefixEnabled: b.prefixEnabled || false, prefixFormat: b.prefixFormat || 'MARKA\u00ae {title}' } }); brandCount++; } catch {} }
    if (Array.isArray(mappings)) for (const m of mappings) { if (!m.xmlBrandName || !m.dgBrandName) continue; const dgBrand = await prisma.brand.findUnique({ where: { name: m.dgBrandName } }); if (!dgBrand) continue; try { await prisma.brandMapping.upsert({ where: { xmlBrandName: m.xmlBrandName }, update: { dgBrandId: dgBrand.id, isAuto: m.isAuto || false }, create: { xmlBrandName: m.xmlBrandName, dgBrandId: dgBrand.id, isAuto: m.isAuto || false } }); mappingCount++; } catch {} }
    await createBrandLog({ action: 'BRAND_CREATE', productCount: brandCount + mappingCount, details: JSON.stringify({ importedBrands: brandCount, importedMappings: mappingCount }), actorUserId: (req as AuthedRequest).actor?.userId });
    res.json({ brandCount, mappingCount, message: `${brandCount} marka, ${mappingCount} e\u015fle\u015ftirme i\u00e7e aktar\u0131ld\u0131` });
  } catch (error) { console.error('[brands] POST import error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: '\u0130\u00e7e aktarma ba\u015far\u0131s\u0131z' } }); }
});

// ==================== UNDO ====================

router.post('/undo/:logId', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;
    const log = await prisma.brandLog.findUnique({ where: { id: logId } });
    if (!log) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Log bulunamad\u0131' } });
    let undoneCount = 0;
    switch (log.action) {
      case 'BRAND_MATCH': case 'BULK_CHANGE':
        if (log.dgBrandId) { const result = await prisma.product.updateMany({ where: { brandId: log.dgBrandId }, data: { brandId: null, brandMatch: false, brandUsageType: 'XML_BRAND' } }); undoneCount = result.count; } break;
      case 'PREFIX_APPLY':
        await prisma.product.updateMany({ where: { prefixEnabled: true }, data: { computedTitle: null, prefixEnabled: false } });
        const products = await prisma.product.findMany({ where: { originalTitle: { not: null } }, select: { id: true, originalTitle: true } });
        for (const p of products) { if (p.originalTitle) await prisma.product.update({ where: { id: p.id }, data: { title: p.originalTitle } }); } undoneCount = products.length; break;
      case 'PREFIX_REMOVE':
        const details = log.details ? JSON.parse(log.details) : {};
        if (details.format && details.brandName) { const prods = await prisma.product.findMany({ where: { originalTitle: { not: null } }, select: { id: true, originalTitle: true } }); for (const p of prods) { if (p.originalTitle) { const ct = applyPrefixFormat(details.format, details.brandName || 'MARKA', p.originalTitle); await prisma.product.update({ where: { id: p.id }, data: { title: ct, computedTitle: ct, prefixEnabled: true } }); } } undoneCount = prods.length; } break;
      case 'AI_MATCH': const result = await prisma.product.updateMany({ where: { matchedBy: 'ai' }, data: { brandId: null, brandMatch: false, matchedBy: null } }); undoneCount = result.count; break;
      case 'BRAND_CREATE': const lastBrand = await prisma.brand.findFirst({ orderBy: { createdAt: 'desc' } }); if (lastBrand && (!log.dgBrandId || lastBrand.id === log.dgBrandId)) { await prisma.brandMapping.deleteMany({ where: { dgBrandId: lastBrand.id } }); await prisma.brand.delete({ where: { id: lastBrand.id } }); undoneCount = 1; } break;
    }
    await createBrandLog({ action: 'UNDO', details: JSON.stringify({ originalLogId: logId, originalAction: log.action }), productCount: undoneCount, actorUserId: (req as AuthedRequest).actor?.userId });
    res.json({ undoneCount, message: `Geri alma i\u015flemi tamamland\u0131: ${undoneCount} kay\u0131t etkilendi` });
  } catch (error) { console.error('[brands] POST undo error:', error); res.status(500).json({ error: { code: 'DB_ERROR', message: 'Geri alma ba\u015far\u0131s\u0131z' } }); }
});

// ==================== CRUD ENDPOINTS ====================

// GET /brands - Public list
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Markalar alınamadı' } });
  }
});

// POST /brands - Create brand
router.post('/', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'name zorunludur' } });
    }
    const item = await prisma.brand.create({ data: { name: String(name).trim() } });
    return res.status(201).json({ item });
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Marka oluşturulamadı' } });
  }
});

// DELETE /brands/:id - Delete brand
router.delete('/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    await prisma.brand.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Marka bulunamadı' } });
  }
});

export default router;
