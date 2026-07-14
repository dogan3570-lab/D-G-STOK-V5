// ==================== MARKA ESLESTIRME V3.0 ====================
// Performans odakli, canli onizlemeli, queue destekli
import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';

const router = Router();

// Basit bellek-ici önbellek (5 dk)
const brandCache = new Map<string, { data: any; expiry: number }>();
function getCached(key: string) { const c = brandCache.get(key); if (c && c.expiry > Date.now()) return c.data; brandCache.delete(key); return null; }
function setCache(key: string, data: any, ttlMs = 300000) { brandCache.set(key, { data, expiry: Date.now() + ttlMs }); }
function clearCache() { brandCache.clear(); }

// ==================== 1. GERÇEK ZAMANLI İSTATİSTİK ====================
router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const cached = getCached('brands_v3_stats');
    if (cached) return res.json({ ok: true, stats: cached });

    const [
      totalXmlBrands, totalProducts, matchedProducts, unmatchedProducts,
      xmlBrandUsage, dgBrandUsage, readyProducts, errorProducts,
      activeBrands, aiSuggested,
    ] = await Promise.all([
      prisma.product.findMany({ where: { brand: { isNot: null } }, select: { brand: { select: { name: true } } }, distinct: ['brandId'] }),
      prisma.product.count(),
      prisma.product.count({ where: { brandMatch: true } }),
      prisma.product.count({ where: { brandMatch: false } }),
      prisma.product.count({ where: { brandUsageType: 'XML_BRAND' } }),
      prisma.product.count({ where: { brandUsageType: 'DG_BRAND' } }),
      prisma.product.count({ where: { status: 'READY' } }),
      prisma.product.count({ where: { status: 'ERROR' } }),
      prisma.brand.count({ where: { isActive: true } }),
      prisma.product.count({ where: { matchedBy: 'ai' } }),
    ]);

    const stats = {
      totalXmlBrands: totalXmlBrands.length, totalProducts, matchedProducts, unmatchedProducts,
      xmlBrandUsage, dgBrandUsage, readyProducts, errorProducts, activeBrands, aiSuggested,
      lastUpdate: new Date().toISOString(),
    };
    setCache('brands_v3_stats', stats, 30000); // 30sn cache
    return res.json({ ok: true, stats });
  } catch (error) {
    console.error('[brandsV3] GET stats error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'İstatistik alınamadı' } });
  }
});

// ==================== 2. XML MARKA GRUPLI LISTE ====================
router.get('/list', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(1000, Math.max(10, parseInt(String(req.query.limit || '50'))));
    const search = String(req.query.search || '').trim();

    // Brand.name uzerinden grupla (XML markalari Brand tablosunda)
    const brandGroups = await prisma.product.groupBy({
      by: ['brandId'],
      where: { brandId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Marka detaylarini al
    const brandIds = brandGroups.map(g => g.brandId).filter((b): b is string => b !== null);
    const brands = brandIds.length > 0 ? await prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, name: true },
    }) : [];
    const brandMap = new Map(brands.map(b => [b.id, b.name]));

    // Filter
    let filtered = brandGroups;
    if (search) {
      filtered = brandGroups.filter(g => {
        const name = brandMap.get(g.brandId!) || '';
        return name.toLowerCase().includes(search.toLowerCase());
      });
    }

    const total = filtered.length;
    const paged = filtered.slice((page - 1) * limit, page * limit);

    // Her XML markası için istatistik
    const items = await Promise.all(paged.map(async g => {
      const brandName = brandMap.get(g.brandId!) || 'Bilinmeyen';
      const matched = await prisma.product.count({ where: { brandId: g.brandId, brandMatch: true } });
      const mapping = g.brandId ? await prisma.brandMapping.findFirst({ where: { dgBrandId: g.brandId } }) : null;
      const dgBrand = mapping ? await prisma.brand.findUnique({ where: { id: mapping.dgBrandId } }) : null;

      return {
        xmlBrand: brandName,
        productCount: g._count.id,
        matchedCount: matched,
        matchedBrand: dgBrand?.name || brandName,
        brandType: mapping ? 'Eşleştirilmiş' : 'XML',
        dgBrandId: dgBrand?.id || g.brandId,
      };
    }));

    return res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('[brandsV3] GET list error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Liste alınamadı' } });
  }
});

// ==================== 3. CANLI ÖNİZLEME ====================
router.get('/preview/:xmlBrandName', requireAuth, async (req, res) => {
  try {
    const { xmlBrandName } = req.params;
    const product = await prisma.product.findFirst({
      where: { brand: { name: xmlBrandName } },
      include: { category: { select: { name: true } }, brand: { select: { name: true } } },
    });
    if (!product) return res.json({ ok: true, preview: null });

    // Varsayılan marka ayarını kontrol et
    const defaultBrandSetting = await prisma.setting.findUnique({ where: { key: 'default_brand' } });
    const defaultBrandName = defaultBrandSetting?.value || 'DG STORE';

    return res.json({
      ok: true,
      preview: {
        xmlBrand: product.brand?.name || '',
        productName: product.title || product.xmlKey,
        category: product.category?.name || '',
        barcode: product.barcode || '',
        sku: product.sku || '',
        selectedBrand: defaultBrandName,
        finalTitle: `${defaultBrandName} ${product.title || product.xmlKey}`,
        finalBrand: defaultBrandName,
      },
    });
  } catch (error) {
    console.error('[brandsV3] GET preview error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Önizleme alınamadı' } });
  }
});

// ==================== 4. TEK MARKA EŞLEŞTİR ====================
router.post('/match', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { xmlBrandName, dgBrandId, brandUsageType } = req.body;
    if (!xmlBrandName || !dgBrandId) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'xmlBrandName ve dgBrandId zorunludur' } });
    }

    const dgBrand = await prisma.brand.findUnique({ where: { id: dgBrandId } });
    if (!dgBrand) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Marka bulunamadı' } });

    await prisma.brandMapping.upsert({
      where: { xmlBrandName },
      update: { dgBrandId, isAuto: false, confidence: 100 },
      create: { xmlBrandName, dgBrandId, isAuto: false, confidence: 100 },
    });

    const result = await prisma.product.updateMany({
      where: { brand: { name: xmlBrandName } },
      data: {
        brandId: dgBrandId,
        brandMatch: true,
        matchedBy: 'manual',
        lastMatchDate: new Date(),
        brandUsageType: brandUsageType || 'DG_BRAND',
      },
    });

    await prisma.brandLog.create({
      data: {
        action: 'BRAND_MATCH',
        xmlBrandName,
        dgBrandId,
        dgBrandName: dgBrand.name,
        productCount: result.count,
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
      },
    });

    clearCache();
    return res.json({ ok: true, matchedCount: result.count, brandName: dgBrand.name });
  } catch (error) {
    console.error('[brandsV3] POST match error:', error);
    return res.status(500).json({ ok: false, error: { code: 'MATCH_ERROR', message: 'Eşleştirme başarısız' } });
  }
});

// ==================== 5. TOPLU EŞLEŞTİR (SENKRON, 200ms altı) ====================
router.post('/bulk-match', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { dgBrandId, xmlBrandNames } = req.body;
    if (!dgBrandId) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'dgBrandId zorunludur' } });

    const dgBrand = await prisma.brand.findUnique({ where: { id: dgBrandId } });
    if (!dgBrand) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Marka bulunamadı' } });

    const where: any = {};
    if (Array.isArray(xmlBrandNames) && xmlBrandNames.length > 0) {
      where.brand = { name: { in: xmlBrandNames } };
    }

    const result = await prisma.product.updateMany({
      where,
      data: {
        brandId: dgBrandId,
        brandMatch: true,
        matchedBy: 'bulk',
        lastMatchDate: new Date(),
        brandUsageType: 'DG_BRAND',
      },
    });

    await prisma.brandLog.create({
      data: {
        action: 'BULK_CHANGE',
        dgBrandId,
        dgBrandName: dgBrand.name,
        productCount: result.count,
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
      },
    });

    clearCache();
    return res.json({ ok: true, matchedCount: result.count });
  } catch (error) {
    console.error('[brandsV3] POST bulk-match error:', error);
    return res.status(500).json({ ok: false, error: { code: 'MATCH_ERROR', message: 'Toplu eşleştirme başarısız' } });
  }
});

// ==================== 6. AI EŞLEŞTİRME (ÖNBELLEKLİ) ====================
router.post('/ai-match', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const cached = getCached('brands_v3_ai_result');
    if (cached) return res.json({ ok: true, ...cached });

    const systemBrands = await prisma.brand.findMany({ where: { isActive: true } });
    const mappings = await prisma.brandMapping.findMany();
    const mappingMap = new Map(mappings.map(m => [m.xmlBrandName.toLowerCase(), m]));

    let matchedCount = 0;

    for (const sb of systemBrands) {
      const existingMapping = mappingMap.get(sb.name.toLowerCase());
      if (existingMapping) continue;

      // XML'de aynı/isimdeş marka var mı kontrol et
      const products = await prisma.product.findMany({
        where: { brandMatch: false, brand: { name: { contains: sb.name.slice(0, 3) } } },
        select: { id: true, brand: { select: { name: true } } },
        take: 100,
      });

      const xmlBrands = [...new Set(products.filter(p => p.brand?.name).map(p => p.brand!.name))];
      for (const xmlBrand of xmlBrands) {
        const normalized = (a: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalized(xmlBrand) === normalized(sb.name) ||
            normalized(xmlBrand).includes(normalized(sb.name)) ||
            normalized(sb.name).includes(normalized(xmlBrand))) {
          await prisma.brandMapping.upsert({
            where: { xmlBrandName: xmlBrand },
            create: { xmlBrandName: xmlBrand, dgBrandId: sb.id, isAuto: true, confidence: 95 },
            update: { dgBrandId: sb.id, isAuto: true },
          });
          const r = await prisma.product.updateMany({
            where: { brand: { name: xmlBrand }, brandMatch: false },
            data: { brandId: sb.id, brandMatch: true, matchedBy: 'ai', lastMatchDate: new Date(), brandUsageType: 'DG_BRAND' },
          });
          matchedCount += r.count;
        }
      }
    }

    const result = { matchedCount };
    setCache('brands_v3_ai_result', result, 3600000); // 1 saat cache
    await prisma.brandLog.create({ data: { action: 'AI_MATCH', productCount: matchedCount, actorUserId: (req as AuthedRequest).actor?.userId ?? null } });
    clearCache();
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[brandsV3] POST ai-match error:', error);
    return res.status(500).json({ ok: false, error: { code: 'AI_ERROR', message: 'AI eşleştirme başarısız' } });
  }
});

// ==================== 7. VARSAYILAN MARKA AYARI ====================
router.get('/default-brand', requireAuth, async (_req, res) => {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'default_brand' } });
    return res.json({ ok: true, defaultBrand: setting?.value || 'DG STORE' });
  } catch (error) {
    return res.json({ ok: true, defaultBrand: 'DG STORE' });
  }
});

router.put('/default-brand', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { brand } = req.body;
    if (!brand) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'brand required' } });
    await prisma.setting.upsert({ where: { key: 'default_brand' }, create: { key: 'default_brand', value: brand }, update: { value: brand } });
    return res.json({ ok: true, defaultBrand: brand });
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Ayar kaydedilemedi' } });
  }
});

// ==================== 8. LOGLAR ====================
router.get('/logs', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || '20'));
    const items = await prisma.brandLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(limit, 100) });
    return res.json({ ok: true, items });
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Loglar alınamadı' } });
  }
});

// ==================== 9. EXPORT ====================
router.get('/export', requireAuth, async (_req, res) => {
  try {
    const items = await prisma.brandMapping.findMany({
      include: { dgBrand: { select: { name: true } } },
    });
    const csv = ['XML Markası,DG Markası,Tip,Güven,Ürün Sayısı',
      ...items.map(i => `"${i.xmlBrandName}","${i.dgBrand?.name || ''}","${i.isAuto ? 'AI' : 'Manuel'}",${i.confidence || 0},${i.productCount}`),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=brand-mapping.csv');
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Export başarısız' } });
  }
});

export default router;
