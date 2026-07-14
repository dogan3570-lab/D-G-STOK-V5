// ==================== MARKA ESLESTIRME V3.0 ====================
import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';

const router = Router();
const brandCache = new Map<string, { data: any; expiry: number }>();
function getCached(key: string) { const c = brandCache.get(key); if (c && c.expiry > Date.now()) return c.data; brandCache.delete(key); return null; }
function setCache(key: string, data: any, ttlMs = 300000) { brandCache.set(key, { data, expiry: Date.now() + ttlMs }); }
function clearCache() { brandCache.clear(); }

// ==================== 1. STATS ====================
router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const cached = getCached('brands_v3_stats');
    if (cached) return res.json({ ok: true, stats: cached });

    const [totalXmlBrands, totalProducts, matchedProducts, unmatchedProducts, xmlBrandUsage, dgBrandUsage, readyProducts, errorProducts, activeBrands, aiSuggested] = await Promise.all([
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

    const stats = { totalXmlBrands: totalXmlBrands.length, totalProducts, matchedProducts, unmatchedProducts, xmlBrandUsage, dgBrandUsage, readyProducts, errorProducts, activeBrands, aiSuggested, lastUpdate: new Date().toISOString() };
    setCache('brands_v3_stats', stats, 30000);
    return res.json({ ok: true, stats });
  } catch (error) {
    console.error('[brandsV3] GET stats error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'İstatistik alınamadı' } });
  }
});

// ==================== 2. LIST ====================
router.get('/list', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(1000, Math.max(10, parseInt(String(req.query.limit || '50'))));
    const search = String(req.query.search || '').trim();

    // Benzersiz XML markalarini brandId ile bul
    const products = await prisma.product.findMany({
      where: { brandId: { not: null } },
      select: { brandId: true, brand: { select: { name: true } } },
      distinct: ['brandId'],
    });

    // Marka isimlerini ve sayilarini topla
    type BrandEntry = { name: string; count: number };
    const brandMap = new Map<string, BrandEntry>();
    for (const p of products) {
      if (p.brandId && p.brand?.name) {
        brandMap.set(p.brandId, { name: p.brand.name, count: 0 });
      }
    }

    // Her marka icin urun sayisini al
    const counts = await Promise.all(
      Array.from(brandMap.keys()).map(id =>
        prisma.product.count({ where: { brandId: id } }).then(c => ({ id, count: c }))
      )
    );
    for (const c of counts) {
      const entry = brandMap.get(c.id);
      if (entry) entry.count = c.count;
    }

    // Markalari sirala ve sayfala
    const sorted = Array.from(brandMap.entries())
      .filter(([_, v]) => !search || v.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b[1].count - a[1].count);

    const total = sorted.length;
    const paged = sorted.slice((page - 1) * limit, page * limit);

    // Her marka icin detaylari al
    const items = await Promise.all(paged.map(async ([brandId, info]) => {
      const mapping = await prisma.brandMapping.findFirst({ where: { dgBrandId: brandId } });
      const matchedCount = await prisma.product.count({ where: { brandId, brandMatch: true } });
      return {
        xmlBrand: info.name,
        productCount: info.count,
        matchedCount,
        matchedBrand: info.name,
        brandType: 'XML',
        dgBrandId: brandId,
      };
    }));

    return res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('[brandsV3] GET list error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Liste alınamadı' } });
  }
});

// ==================== 3. PREVIEW ====================
router.get('/preview/:xmlBrandName', requireAuth, async (req, res) => {
  try {
    const product = await prisma.product.findFirst({
      where: { brand: { name: req.params.xmlBrandName } },
      include: { category: { select: { name: true } }, brand: { select: { name: true } } },
    });
    if (!product) return res.json({ ok: true, preview: null });

    const setting = await prisma.setting.findUnique({ where: { key: 'default_brand' } });
    const selectedBrand = setting?.value || 'DG STORE';
    const productName = product.title || product.xmlKey;
    // Marka® Ürün Adı formatı
    const finalTitle = `${selectedBrand}® ${productName}`;

    return res.json({
      ok: true,
      preview: {
        xmlBrand: product.brand?.name || '',
        productName,
        category: product.category?.name || '',
        barcode: product.barcode || '',
        sku: product.sku || '',
        selectedBrand,
        finalTitle,
        finalBrand: selectedBrand,
        formatDescription: 'Marka® Ürün Adı şeklinde pazaryerine gönderilecek',
      },
    });
  } catch (error) {
    console.error('[brandsV3] GET preview error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Önizleme alınamadı' } });
  }
});

// ==================== 4. CREATE BRAND (Kullanici kendi markasini olusturur) ====================
router.post('/create-brand', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Marka adı zorunludur' } });

    const existing = await prisma.brand.findUnique({ where: { name: name.trim() } });
    if (existing) return res.json({ ok: true, brand: existing, alreadyExists: true });

    const brand = await prisma.brand.create({ data: { name: name.trim(), isActive: true } });
    return res.status(201).json({ ok: true, brand, alreadyExists: false });
  } catch (error) {
    console.error('[brandsV3] POST create-brand error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Marka oluşturulamadı' } });
  }
});

// ==================== 5. MATCH (xmlBrandName + customBrandName veya dgBrandId ile) ====================
router.post('/match', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { xmlBrandName, dgBrandId, customBrandName } = req.body;
    if (!xmlBrandName) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'xmlBrandName zorunludur' } });
    if (!dgBrandId && !customBrandName) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'dgBrandId veya customBrandName zorunludur' } });

    let targetBrandId = dgBrandId;
    let targetBrandName = '';

    if (customBrandName) {
      // Kullanici kendi markasini girdi - bul veya olustur
      let brand = await prisma.brand.findUnique({ where: { name: customBrandName.trim() } });
      if (!brand) {
        brand = await prisma.brand.create({ data: { name: customBrandName.trim(), isActive: true } });
      }
      targetBrandId = brand.id;
      targetBrandName = brand.name;
    } else {
      const dgBrand = await prisma.brand.findUnique({ where: { id: dgBrandId } });
      if (!dgBrand) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Marka bulunamadı' } });
      targetBrandName = dgBrand.name;
    }

    await prisma.brandMapping.upsert({
      where: { xmlBrandName },
      update: { dgBrandId: targetBrandId, isAuto: false, confidence: 100 },
      create: { xmlBrandName, dgBrandId: targetBrandId, isAuto: false, confidence: 100 },
    });

    const result = await prisma.product.updateMany({
      where: { brand: { name: xmlBrandName } },
      data: { brandId: targetBrandId, brandMatch: true, matchedBy: 'manual', lastMatchDate: new Date(), brandUsageType: 'DG_BRAND' },
    });

    await prisma.brandLog.create({
      data: { action: 'BRAND_MATCH', xmlBrandName, dgBrandId: targetBrandId, dgBrandName: targetBrandName, productCount: result.count, actorUserId: (req as AuthedRequest).actor?.userId ?? null },
    });

    clearCache();
    return res.json({ ok: true, matchedCount: result.count, brandName: targetBrandName });
  } catch (error) {
    console.error('[brandsV3] POST match error:', error);
    return res.status(500).json({ ok: false, error: { code: 'MATCH_ERROR', message: 'Eşleştirme başarısız' } });
  }
});

// ==================== 5. BULK MATCH ====================
router.post('/bulk-match', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { dgBrandId } = req.body;
    if (!dgBrandId) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'dgBrandId zorunludur' } });

    const dgBrand = await prisma.brand.findUnique({ where: { id: dgBrandId } });
    if (!dgBrand) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Marka bulunamadı' } });

    const result = await prisma.product.updateMany({
      where: { brandMatch: false },
      data: { brandId: dgBrandId, brandMatch: true, matchedBy: 'bulk', lastMatchDate: new Date(), brandUsageType: 'DG_BRAND' },
    });

    await prisma.brandLog.create({
      data: { action: 'BULK_CHANGE', dgBrandId, dgBrandName: dgBrand.name, productCount: result.count, actorUserId: (req as AuthedRequest).actor?.userId ?? null },
    });

    clearCache();
    return res.json({ ok: true, matchedCount: result.count });
  } catch (error) {
    console.error('[brandsV3] POST bulk-match error:', error);
    return res.status(500).json({ ok: false, error: { code: 'MATCH_ERROR', message: 'Toplu eşleştirme başarısız' } });
  }
});

// ==================== 6. AI MATCH ====================
router.post('/ai-match', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const cached = getCached('brands_v3_ai_result');
    if (cached) return res.json({ ok: true, ...cached });

    const systemBrands = await prisma.brand.findMany({ where: { isActive: true } });
    let matchedCount = 0;

    for (const sb of systemBrands) {
      const products = await prisma.product.findMany({
        where: { brandMatch: false, brand: { name: { contains: sb.name.slice(0, 3) } } },
        select: { id: true, brand: { select: { name: true } } },
        take: 100,
      });

      const xmlBrands = [...new Set(products.filter(p => p.brand?.name).map(p => p.brand!.name))];
      for (const xmlBrand of xmlBrands) {
        const normalized = (a: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalized(xmlBrand) === normalized(sb.name) || normalized(xmlBrand).includes(normalized(sb.name))) {
          await prisma.brandMapping.upsert({ where: { xmlBrandName: xmlBrand }, create: { xmlBrandName: xmlBrand, dgBrandId: sb.id, isAuto: true, confidence: 95 }, update: { dgBrandId: sb.id, isAuto: true } });
          const r = await prisma.product.updateMany({ where: { brand: { name: xmlBrand }, brandMatch: false }, data: { brandId: sb.id, brandMatch: true, matchedBy: 'ai', lastMatchDate: new Date(), brandUsageType: 'DG_BRAND' } });
          matchedCount += r.count;
        }
      }
    }

    const result = { matchedCount };
    setCache('brands_v3_ai_result', result, 3600000);
    await prisma.brandLog.create({ data: { action: 'AI_MATCH', productCount: matchedCount, actorUserId: (req as AuthedRequest).actor?.userId ?? null } });
    clearCache();
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[brandsV3] POST ai-match error:', error);
    return res.status(500).json({ ok: false, error: { code: 'AI_ERROR', message: 'AI eşleştirme başarısız' } });
  }
});

// ==================== 7. DEFAULT BRAND ====================
router.get('/default-brand', requireAuth, async (_req, res) => {
  const setting = await prisma.setting.findUnique({ where: { key: 'default_brand' } });
  return res.json({ ok: true, defaultBrand: setting?.value || 'DG STORE' });
});

router.put('/default-brand', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  const { brand } = req.body;
  if (!brand) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'brand required' } });
  await prisma.setting.upsert({ where: { key: 'default_brand' }, create: { key: 'default_brand', value: brand }, update: { value: brand } });
  return res.json({ ok: true, defaultBrand: brand });
});

// ==================== 8. LOGS ====================
router.get('/logs', requireAuth, async (req, res) => {
  const limit = parseInt(String(req.query.limit || '20'));
  const items = await prisma.brandLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(limit, 100) });
  return res.json({ ok: true, items });
});

// ==================== 9. EXPORT ====================
router.get('/export', requireAuth, async (_req, res) => {
  const items = await prisma.brandMapping.findMany({ include: { dgBrand: { select: { name: true } } } });
  const csv = ['XML Markası,DG Markası,Tip,Güven,Ürün Sayısı',
    ...items.map(i => `"${i.xmlBrandName}","${i.dgBrand?.name || ''}","${i.isAuto ? 'AI' : 'Manuel'}",${i.confidence || 0},${i.productCount}`),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=brand-mapping.csv');
  return res.send(csv);
});

export default router;
