// ==================== VARYANT MOTORU V5.0 ROUTES ====================
// DG STOK V5.0 - Category-Based Smart Variant Engine (ANA VARYANT MOTORU)
// =====================================================================

import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole } from '../auth/authMiddleware.ts';
import { EventBus } from '../services/eventBus/EventBus.ts';
import { createCorrelationId } from '../services/eventBus/events.ts';
import {
  runV5Pipeline,
  decideProductById,
  getCategoryConfig,
  updateCategoryVariantConfig,
  clearCategoryCache,
  getDecisionHistory,
} from '../services/variantEngineV5/index.ts';

const router = Router();

// ==================== PIPELINE (V5 ÖZGÜ) ====================

// POST /variants/run - V5 Pipeline'ı çalıştır
router.post('/run', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: any, res: any) => {
  try {
    const { xmlSourceId } = req.body;
    const result = await runV5Pipeline(xmlSourceId || undefined);

    // Pipeline sonrası Workflow cascade'ini tetikle
    const matchedProductIds = result.decisions
      .filter(d => d.status === 'AUTO_APPROVED' || d.status === 'AUTO_CREATED')
      .map(d => d.productId);
    if (matchedProductIds.length > 0) {
      EventBus.emit({
        type: 'VariantMatchChanged',
        correlationId: createCorrelationId('WF'),
        timestamp: new Date().toISOString(),
        source: 'VariantEngineV5',
        data: {
          productIds: matchedProductIds,
          productCount: matchedProductIds.length,
          oldValue: false,
          newValue: true,
          source: 'auto',
        },
      });
    }

    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[V5] Pipeline error:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// POST /variants/run/:xmlSourceId - Belirli XML kaynağı için pipeline
router.post('/run/:xmlSourceId', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: any, res: any) => {
  try {
    const result = await runV5Pipeline(req.params.xmlSourceId);

    // Pipeline sonrası Workflow cascade'ini tetikle
    const matchedProductIds = result.decisions
      .filter(d => d.status === 'AUTO_APPROVED' || d.status === 'AUTO_CREATED')
      .map(d => d.productId);
    if (matchedProductIds.length > 0) {
      EventBus.emit({
        type: 'VariantMatchChanged',
        correlationId: createCorrelationId('WF'),
        timestamp: new Date().toISOString(),
        source: 'VariantEngineV5',
        data: {
          productIds: matchedProductIds,
          productCount: matchedProductIds.length,
          oldValue: false,
          newValue: true,
          source: 'auto',
        },
      });
    }

    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[V5] Pipeline error:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== TEK ÜRÜN KARARI ====================

// GET /variants/decide/:productId - Tek ürün için karar
router.get('/decide/:productId', requireAuth, async (req: any, res: any) => {
  try {
    const decision = await decideProductById(req.params.productId);
    if (!decision) return res.status(404).json({ ok: false, error: 'Ürün bulunamadı' });
    return res.json({ ok: true, decision });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// GET /variants/decide/:productId/history - Karar geçmişi
router.get('/decide/:productId/history', requireAuth, async (req: any, res: any) => {
  try {
    const history = await getDecisionHistory(req.params.productId, Number(req.query.limit) || 10);
    return res.json({ ok: true, items: history });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== KATEGORİ YAPILANDIRMASI ====================

// GET /variants/category/:categoryId - Kategori yapılandırması
router.get('/category/:categoryId', requireAuth, async (req: any, res: any) => {
  try {
    const config = await getCategoryConfig(req.params.categoryId);
    return res.json({ ok: true, config });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// PUT /variants/category/:categoryId - Kategori yapılandırmasını güncelle
router.put('/category/:categoryId', requireAuth, requireRole(['ADMIN']), async (req: any, res: any) => {
  try {
    await updateCategoryVariantConfig(req.params.categoryId, req.body);
    clearCategoryCache();
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== CRUD: VARYANT LİSTELE / OLUŞTUR / GÜNCELLE / SİL ====================

// GET /variants - Varyant listesi (sayfalanmış, filtreli)
router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const name = req.query?.name ? String(req.query.name).trim() : null;
    const limit = Math.min(Number(req.query?.limit) || 500, 1000);
    const offset = Number(req.query?.offset) || 0;
    const where: any = {};
    if (search) {
      where.OR = [{ name: { contains: search } }, { value: { contains: search } }];
    }
    if (name) where.name = name;

    const [items, total] = await Promise.all([
      prisma.variant.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: {
            select: {
              id: true, title: true, xmlKey: true, sku: true,
              images: true, salePrice: true, stock: true,
            },
          },
        },
      }),
      prisma.variant.count({ where }),
    ]);

    return res.json({ items, total, limit, offset });
  } catch (error) {
    console.error('[V5] GET /variants error:', error);
    return res.status(500).json({ ok: false, error: 'Varyant listesi alınamadı' });
  }
});

// GET /variants/types - Varyant tipleri (groupBy name)
router.get('/types', requireAuth, async (_req: any, res: any) => {
  try {
    const types = await prisma.variant.groupBy({
      by: ['name'],
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
    });
    return res.json({ items: types.map(t => ({ name: t.name, count: t._count.name })) });
  } catch (error) {
    console.error('[V5] GET /variants/types error:', error);
    return res.status(500).json({ ok: false, error: 'Varyant tipleri alınamadı' });
  }
});

// GET /variants/stats - Varyant istatistikleri
router.get('/stats', requireAuth, async (_req: any, res: any) => {
  try {
    const [totalVariants, matchedProducts, unmatchedProducts, variantTypes] = await Promise.all([
      prisma.variant.count(),
      prisma.product.count({ where: { variantMatch: true } }),
      prisma.product.count({ where: { variantMatch: false } }),
      prisma.variant.groupBy({
        by: ['name'],
        _count: { name: true },
        orderBy: { _count: { name: 'desc' } },
      }),
    ]);

    return res.json({
      totalVariants,
      matchedProducts,
      unmatchedProducts,
      productsWithVariants: matchedProducts,
      variantTypes: variantTypes.map(v => ({ name: v.name, count: v._count.name })),
    });
  } catch (error) {
    console.error('[V5] GET /variants/stats error:', error);
    return res.status(500).json({ ok: false, error: 'Varyant istatistikleri alınamadı' });
  }
});

// GET /variants/logs - Varyant logları
router.get('/logs', requireAuth, async (req: any, res: any) => {
  try {
    const limit = Math.min(Number(req.query?.limit) || 50, 200);
    const items = await prisma.auditLog.findMany({
      where: { entity: 'variant' },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, details: true, createdAt: true, actorUserId: true },
    });
    return res.json({ items });
  } catch (error) {
    console.error('[V5] GET /variants/logs error:', error);
    return res.status(500).json({ ok: false, error: 'Varyant logları alınamadı' });
  }
});

// GET /variants/unmatched - Eşleşmemiş ürünler
router.get('/unmatched', requireAuth, async (req: any, res: any) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const limit = Math.min(Number(req.query?.limit) || 100, 500);
    const offset = Number(req.query?.offset) || 0;
    const where: any = { variantMatch: false };
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { xmlKey: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, xmlKey: true, sku: true, barcode: true,
          stock: true, salePrice: true, images: true, supplierCategory: true,
          xmlSource: { select: { id: true, name: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({ items, total });
  } catch (error) {
    console.error('[V5] GET /variants/unmatched error:', error);
    return res.status(500).json({ ok: false, error: 'Eşleşmemiş ürünler alınamadı' });
  }
});

// GET /variants/:id - Tek varyant getir (ROUTE SIRASI ÖNEMLİ: spesifik route'lar önce gelir)
// NOT: :id parametresi "decide", "category", "types", "stats", "logs", "unmatched", "run" ile eşleşmez
// Express parametrik route'ları static route'lardan sonra tanımlanır
router.get('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const item = await prisma.variant.findUnique({
      where: { id: req.params.id },
      include: {
        product: {
          select: {
            id: true, title: true, xmlKey: true, sku: true,
            images: true, salePrice: true, stock: true,
          },
        },
      },
    });
    if (!item) return res.status(404).json({ ok: false, error: 'Varyant bulunamadı' });
    return res.json({ item });
  } catch (error) {
    console.error('[V5] GET /variants/:id error:', error);
    return res.status(500).json({ ok: false, error: 'Varyant getirilemedi' });
  }
});

// POST /variants - Varyant oluştur
router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const { name, value, productId } = req.body;
    if (!name || !value) {
      return res.status(400).json({ ok: false, error: 'name ve value gerekli' });
    }

    const item = await prisma.variant.create({
      data: { name, value, productId: productId || undefined },
    });

    if (productId) {
      await prisma.product.update({
        where: { id: productId },
        data: { variantMatch: true },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'VARIANT_CREATE',
        entity: 'variant',
        details: `Varyant oluşturuldu: ${name}:${value} ${productId ? `(ürün: ${productId})` : ''}`,
        actorUserId: req.actor?.userId || null,
      },
    });

    if (productId) {
      EventBus.emit({
        type: 'VariantMatchChanged',
        correlationId: createCorrelationId('WF'),
        timestamp: new Date().toISOString(),
        source: 'VariantEngineV5',
        data: { productIds: [productId], productCount: 1, oldValue: false, newValue: true, source: 'manual' },
      });
    }

    return res.status(201).json({ item });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ ok: false, error: 'Bu varyant zaten mevcut' });
    }
    console.error('[V5] POST /variants error:', error);
    return res.status(500).json({ ok: false, error: 'Varyant oluşturulamadı' });
  }
});

// PUT /variants/:id - Varyant güncelle
router.put('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const { name, value } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (value !== undefined) data.value = value;

    const item = await prisma.variant.update({
      where: { id: req.params.id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        action: 'VARIANT_UPDATE',
        entity: 'variant',
        details: `Varyant güncellendi: ${item.name}:${item.value}`,
        actorUserId: req.actor?.userId || null,
      },
    });

    return res.json({ item });
  } catch (error) {
    console.error('[V5] PUT /variants/:id error:', error);
    return res.status(500).json({ ok: false, error: 'Varyant güncellenemedi' });
  }
});

// DELETE /variants/:id - Varyant sil
router.delete('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const item = await prisma.variant.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, value: true } });
    if (!item) return res.status(404).json({ ok: false, error: 'Varyant bulunamadı' });

    await prisma.variant.delete({ where: { id: req.params.id } });

    await prisma.auditLog.create({
      data: {
        action: 'VARIANT_DELETE',
        entity: 'variant',
        details: `Varyant silindi: ${item.name}:${item.value}`,
        actorUserId: req.actor?.userId || null,
      },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('[V5] DELETE /variants/:id error:', error);
    return res.status(500).json({ ok: false, error: 'Varyant silinemedi' });
  }
});

// POST /variants/batch - Toplu varyant ekle
router.post('/batch', requireAuth, async (req: any, res: any) => {
  try {
    const { name, value, productIds } = req.body;
    if (!name || !value || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'name, value ve productIds gerekli' });
    }
    if (productIds.length > 500) {
      return res.status(400).json({ ok: false, error: 'Maksimum 500 ürün' });
    }

    // Mevcut varyantları kontrol et
    const existing = await prisma.variant.findMany({
      where: { productId: { in: productIds }, name, value },
      select: { productId: true },
    });
    const existingSet = new Set(existing.map(e => e.productId));
    const newData = productIds.filter(pid => !existingSet.has(pid)).map(pid => ({ name, value, productId: pid }));

    let created = 0;
    if (newData.length > 0) {
      for (let i = 0; i < newData.length; i += 100) {
        const batch = newData.slice(i, i + 100);
        await prisma.variant.createMany({ data: batch });
        created += batch.length;
      }
    }

    if (created > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { variantMatch: true },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: 'BATCH_VARIANT_CREATE',
        entity: 'variant',
        details: `Toplu varyant: ${created} adet ${name}:${value}`,
        actorUserId: req.actor?.userId || null,
      },
    });

    if (created > 0) {
      EventBus.emit({
        type: 'VariantMatchChanged',
        correlationId: createCorrelationId('WF'),
        timestamp: new Date().toISOString(),
        source: 'VariantEngineV5',
        data: { productIds, productCount: productIds.length, oldValue: false, newValue: true, source: 'auto' },
      });
    }

    return res.json({
      created,
      skipped: productIds.length - created,
      message: `${created} varyant oluşturuldu, ${productIds.length - created} zaten vardı`,
    });
  } catch (error) {
    console.error('[V5] POST /variants/batch error:', error);
    return res.status(500).json({ ok: false, error: 'Toplu varyant ekleme başarısız' });
  }
});

// POST /variants/bulk-match - Toplu eşleştirme
router.post('/bulk-match', requireAuth, async (req: any, res: any) => {
  try {
    const { matches } = req.body;
    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ ok: false, error: 'matches array gerekli' });
    }

    const allVariantData: Array<{ productId: string; name: string; value: string }> = [];
    const allProductIds: string[] = [];

    for (const match of matches) {
      const { productId, variants } = match;
      if (!productId || !Array.isArray(variants) || variants.length === 0) continue;
      allProductIds.push(productId);
      for (const variant of variants) {
        const { name, value } = variant;
        if (name && value) allVariantData.push({ productId, name, value });
      }
    }

    let totalCreated = 0;
    if (allVariantData.length > 0) {
      const existingVariants = await prisma.variant.findMany({
        where: {
          OR: allVariantData.map(v => ({ productId: v.productId, name: v.name, value: v.value })),
        },
        select: { productId: true, name: true, value: true },
      });
      const existingKeys = new Set(existingVariants.map(e => `${e.productId}:${e.name}:${e.value}`));
      const newVariants = allVariantData.filter(v => !existingKeys.has(`${v.productId}:${v.name}:${v.value}`));

      for (let i = 0; i < newVariants.length; i += 100) {
        const batch = newVariants.slice(i, i + 100);
        await prisma.variant.createMany({ data: batch });
        totalCreated += batch.length;
      }
    }

    const uniqueProductIds = [...new Set(allProductIds)];
    if (uniqueProductIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: uniqueProductIds } },
        data: { variantMatch: true },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: 'BULK_VARIANT_MATCH',
        entity: 'variant',
        details: `Toplu eşleştirme: ${totalCreated} varyant, ${uniqueProductIds.length} ürün`,
        actorUserId: req.actor?.userId || null,
      },
    });

    if (uniqueProductIds.length > 0) {
      EventBus.emit({
        type: 'VariantMatchChanged',
        correlationId: createCorrelationId('WF'),
        timestamp: new Date().toISOString(),
        source: 'VariantEngineV5',
        data: { productIds: uniqueProductIds, productCount: uniqueProductIds.length, oldValue: false, newValue: true, source: 'manual' },
      });
    }

    return res.json({
      totalCreated,
      totalProducts: uniqueProductIds.length,
      message: `${totalCreated} varyant ${uniqueProductIds.length} ürüne eklendi`,
    });
  } catch (error) {
    console.error('[V5] POST /variants/bulk-match error:', error);
    return res.status(500).json({ ok: false, error: 'Toplu eşleştirme başarısız' });
  }
});

// POST /variants/auto-detect - Otomatik varyant tespiti
router.post('/auto-detect', requireAuth, async (req: any, res: any) => {
  try {
    const { productIds } = req.body;
    const where: any = { variantMatch: false };
    if (Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };

    const products = await prisma.product.findMany({
      where,
      select: { id: true, title: true, xmlKey: true },
      take: 500,
    });

    const colorPatterns = ['kırmızı', 'mavi', 'yeşil', 'sarı', 'beyaz', 'siyah', 'mor', 'turuncu', 'pembe', 'gri', 'lacivert', 'bordo', 'bej', 'kahverengi', 'krem', 'füme', 'metalik', 'altın', 'gümüş', 'turkuaz'];
    const sizePatterns = ['xs', 's', 'm', 'l', 'xl', 'xxl', '3xl', '4xl', '5xl'];

    const variantData: Array<{ productId: string; name: string; value: string }> = [];
    const matchedProductIds: string[] = [];

    for (const product of products) {
      const searchText = [product.title || '', product.xmlKey || ''].join(' ').toLowerCase();
      const detected: Array<{ name: string; value: string }> = [];

      for (const color of colorPatterns) {
        if (searchText.includes(color)) {
          detected.push({ name: 'Renk', value: color.charAt(0).toUpperCase() + color.slice(1) });
          break;
        }
      }

      for (const size of sizePatterns) {
        if (searchText.includes(size)) {
          detected.push({ name: 'Beden', value: size.toUpperCase() });
          break;
        }
      }

      const numberMatches = searchText.match(/\b(\d{2,3})\b/g);
      if (numberMatches) {
        for (const num of numberMatches) {
          const numVal = parseInt(num);
          if ((numVal >= 32 && numVal <= 50) || (numVal >= 36 && numVal <= 46)) {
            detected.push({ name: 'Numara', value: num });
            break;
          }
        }
      }

      if (detected.length > 0) {
        matchedProductIds.push(product.id);
        for (const v of detected) {
          variantData.push({ productId: product.id, name: v.name, value: v.value });
        }
      }
    }

    let totalCreated = 0;
    if (variantData.length > 0) {
      const existingVariants = await prisma.variant.findMany({
        where: {
          OR: variantData.map(v => ({ productId: v.productId, name: v.name, value: v.value })),
        },
        select: { productId: true, name: true, value: true },
      });
      const existingKeys = new Set(existingVariants.map(e => `${e.productId}:${e.name}:${e.value}`));
      const newVariants = variantData.filter(v => !existingKeys.has(`${v.productId}:${v.name}:${v.value}`));

      for (let i = 0; i < newVariants.length; i += 100) {
        const batch = newVariants.slice(i, i + 100);
        await prisma.variant.createMany({ data: batch });
        totalCreated += batch.length;
      }
    }

    if (matchedProductIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: matchedProductIds } },
        data: { variantMatch: true },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: 'AUTO_VARIANT_DETECT',
        entity: 'variant',
        details: `Otomatik tespit: ${totalCreated} varyant, ${matchedProductIds.length} ürün`,
        actorUserId: req.actor?.userId || null,
      },
    });

    if (matchedProductIds.length > 0) {
      EventBus.emit({
        type: 'VariantMatchChanged',
        correlationId: createCorrelationId('WF'),
        timestamp: new Date().toISOString(),
        source: 'VariantEngineV5',
        data: { productIds: matchedProductIds, productCount: matchedProductIds.length, oldValue: false, newValue: true, source: 'auto' },
      });
    }

    return res.json({
      totalDetected: totalCreated,
      totalProductsWithVariants: matchedProductIds.length,
      totalScanned: products.length,
      message: `${totalCreated} varyant ${matchedProductIds.length} üründe tespit edildi`,
    });
  } catch (error) {
    console.error('[V5] POST /variants/auto-detect error:', error);
    return res.status(500).json({ ok: false, error: 'Otomatik varyant tespiti başarısız' });
  }
});

// POST /variants/ai-suggest - AI varyant önerisi
router.post('/ai-suggest', requireAuth, async (req: any, res: any) => {
  try {
    const { productId, title, description } = req.body;
    const searchText = (title || description || '').toLowerCase();

    const colorPatterns = ['kırmızı', 'mavi', 'yeşil', 'sarı', 'beyaz', 'siyah', 'mor', 'turuncu', 'pembe', 'gri', 'lacivert', 'bordo', 'bej', 'kahverengi', 'krem', 'füme', 'metalik', 'altın', 'gümüş', 'turkuaz'];
    const sizePatterns = ['xs', 's', 'm', 'l', 'xl', 'xxl', '3xl', '4xl', '5xl'];

    const suggestions: Array<{ name: string; value: string; confidence: number }> = [];

    for (const color of colorPatterns) {
      if (searchText.includes(color)) {
        suggestions.push({ name: 'Renk', value: color.charAt(0).toUpperCase() + color.slice(1), confidence: 85 });
        break;
      }
    }

    for (const size of sizePatterns) {
      if (searchText.includes(size)) {
        suggestions.push({ name: 'Beden', value: size.toUpperCase(), confidence: 80 });
        break;
      }
    }

    const numberMatches = searchText.match(/\b(\d{2,3})\b/g);
    if (numberMatches) {
      for (const num of numberMatches) {
        const numVal = parseInt(num);
        if ((numVal >= 32 && numVal <= 50)) {
          suggestions.push({ name: 'Numara', value: num, confidence: 75 });
          break;
        }
      }
    }

    return res.json({ suggestions, source: 'pattern' });
  } catch (error) {
    console.error('[V5] POST /variants/ai-suggest error:', error);
    return res.status(500).json({ ok: false, error: 'AI öneri başarısız' });
  }
});

// POST /variants/bulk-ai-suggest - Toplu AI önerisi
router.post('/bulk-ai-suggest', requireAuth, async (req: any, res: any) => {
  try {
    const { productIds } = req.body;
    const where: any = { variantMatch: false };
    if (Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };

    const products = await prisma.product.findMany({
      where,
      select: { id: true, title: true },
      take: 200,
    });

    const colorPatterns = ['kırmızı', 'mavi', 'yeşil', 'sarı', 'beyaz', 'siyah', 'mor', 'turuncu', 'pembe', 'gri', 'lacivert', 'bordo', 'bej', 'kahverengi', 'krem', 'füme', 'metalik', 'altın', 'gümüş', 'turkuaz'];
    const results: Array<{
      productId: string;
      productTitle: string;
      suggestions: Array<{ name: string; value: string; confidence: number }>;
    }> = [];

    for (const product of products) {
      const searchText = (product.title || '').toLowerCase();
      const suggestions: Array<{ name: string; value: string; confidence: number }> = [];

      for (const color of colorPatterns) {
        if (searchText.includes(color)) {
          suggestions.push({ name: 'Renk', value: color.charAt(0).toUpperCase() + color.slice(1), confidence: 85 });
          break;
        }
      }

      if (suggestions.length > 0) {
        results.push({ productId: product.id, productTitle: product.title || '', suggestions });
      }
    }

    return res.json({ totalScanned: products.length, totalSuggestions: results.length, results });
  } catch (error) {
    console.error('[V5] POST /variants/bulk-ai-suggest error:', error);
    return res.status(500).json({ ok: false, error: 'Toplu AI öneri başarısız' });
  }
});

// GET /variants/universal-attributes - Evrensel varyant nitelikleri
router.get('/universal-attributes', (_req: any, res: any) => {
  const UNIVERSAL_ATTRIBUTES = [
    { key: 'Renk', label: 'Renk', icon: '🎨', marketplaces: ['Trendyol', 'Hepsiburada', 'Amazon', 'N11'] },
    { key: 'Beden', label: 'Beden', icon: '👕', marketplaces: ['Trendyol', 'Hepsiburada', 'Amazon', 'N11'] },
    { key: 'Numara', label: 'Numara', icon: '🔢', marketplaces: ['Trendyol', 'Hepsiburada', 'N11'] },
    { key: 'Cinsiyet', label: 'Cinsiyet', icon: '⚤', marketplaces: ['Trendyol', 'Hepsiburada', 'Amazon'] },
    { key: 'Materyal', label: 'Materyal', icon: '🧵', marketplaces: ['Trendyol', 'Hepsiburada', 'Amazon'] },
    { key: 'Kapasite', label: 'Kapasite', icon: '📊', marketplaces: ['Trendyol', 'Hepsiburada'] },
    { key: 'Hacim', label: 'Hacim', icon: '🧊', marketplaces: ['Trendyol', 'Hepsiburada'] },
    { key: 'Model', label: 'Model', icon: '🏷️', marketplaces: ['Trendyol', 'Hepsiburada'] },
    { key: 'Ölçü', label: 'Ölçü', icon: '📐', marketplaces: ['Trendyol', 'Hepsiburada'] },
  ];
  return res.json({ items: UNIVERSAL_ATTRIBUTES });
});

// GET /variants/marketplace-attributes/:key - Pazaryeri spesifik nitelikler
router.get('/marketplace-attributes/:key', (req: any, res: any) => {
  const UNIVERSAL_ATTRIBUTES = [
    { key: 'Renk', label: 'Renk', icon: '🎨', marketplaces: ['Trendyol', 'Hepsiburada', 'Amazon', 'N11'] },
    { key: 'Beden', label: 'Beden', icon: '👕', marketplaces: ['Trendyol', 'Hepsiburada', 'Amazon', 'N11'] },
    { key: 'Numara', label: 'Numara', icon: '🔢', marketplaces: ['Trendyol', 'Hepsiburada', 'N11'] },
    { key: 'Cinsiyet', label: 'Cinsiyet', icon: '⚤', marketplaces: ['Trendyol', 'Hepsiburada', 'Amazon'] },
    { key: 'Materyal', label: 'Materyal', icon: '🧵', marketplaces: ['Trendyol', 'Hepsiburada', 'Amazon'] },
    { key: 'Kapasite', label: 'Kapasite', icon: '📊', marketplaces: ['Trendyol', 'Hepsiburada'] },
    { key: 'Hacim', label: 'Hacim', icon: '🧊', marketplaces: ['Trendyol', 'Hepsiburada'] },
    { key: 'Model', label: 'Model', icon: '🏷️', marketplaces: ['Trendyol', 'Hepsiburada'] },
    { key: 'Ölçü', label: 'Ölçü', icon: '📐', marketplaces: ['Trendyol', 'Hepsiburada'] },
  ];
  const key = req.params.key;
  const mpAttributes: Record<string, typeof UNIVERSAL_ATTRIBUTES> = {
    trendyol: UNIVERSAL_ATTRIBUTES.filter(a => a.marketplaces.includes('Trendyol')),
    hepsiburada: UNIVERSAL_ATTRIBUTES.filter(a => a.marketplaces.includes('Hepsiburada')),
    amazon: UNIVERSAL_ATTRIBUTES.filter(a => a.marketplaces.includes('Amazon')),
    n11: UNIVERSAL_ATTRIBUTES.filter(a => a.marketplaces.includes('N11')),
  };
  return res.json({ items: mpAttributes[key] || UNIVERSAL_ATTRIBUTES });
});

// ==================== İSTİSNA EKRANI (VariantExceptionScreen) ====================

// GET /variants/screen - Varyant istisna ekranı ürünleri (sayfalanmış)
router.get('/screen', requireAuth, async (req: any, res: any) => {
  try {
    const status = req.query?.status ? String(req.query.status) : undefined;
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : undefined;
    const search = req.query?.search ? String(req.query.search) : undefined;
    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));

    const where: any = { variantMatch: false };
    if (xmlSourceId) where.xmlSourceId = xmlSourceId;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { xmlKey: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, sku: true, xmlKey: true, title: true, barcode: true,
          stock: true, status: true, variantMatch: true,
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          xmlSource: { select: { id: true, name: true } },
          variants: { select: { id: true, name: true, value: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const screenProducts = items.map(p => {
      const hasColor = p.variants.some(v => v.name === 'Renk');
      const hasSize = p.variants.some(v => v.name === 'Beden');
      const hasNumber = p.variants.some(v => v.name === 'Numara');

      return {
        id: p.id,
        sku: p.sku,
        xmlKey: p.xmlKey,
        title: p.title,
        barcode: p.barcode,
        brandName: p.brand?.name || null,
        categoryName: p.category?.name || null,
        xmlSourceName: p.xmlSource?.name || null,
        confidence: p.variants.length > 0 ? Math.min(95, 50 + p.variants.length * 15) : 0,
        status: p.variantMatch ? 'AUTO_ACCEPTED' : (p.variants.length > 0 ? 'AUTO_SUGGEST' : 'MANUAL_REVIEW'),
        reason: !p.variantMatch ? (p.variants.length === 0 ? 'Varyant bilgisi bulunamadı' : 'Kısmi eşleşme') : null,
        suggestedAction: p.variantMatch ? null : 'Otomatik veya manuel eşleştirme gerekli',
        hasColor,
        hasSize,
        hasNumber,
        parentSku: p.sku ? p.sku.split(/[-_\s]+/)[0] : null,
        groupId: null,
      };
    });

    return res.json({ ok: true, items: screenProducts, total });
  } catch (error) {
    console.error('[V5] GET /variants/screen error:', error);
    return res.status(500).json({ ok: false, error: 'İstisna ekranı verileri alınamadı' });
  }
});

// GET /variants/problems - Varyant problem listesi
router.get('/problems', requireAuth, async (req: any, res: any) => {
  try {
    const status = req.query?.status ? String(req.query.status) : undefined;
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : undefined;
    const search = req.query?.search ? String(req.query.search) : undefined;
    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));

    const where: any = { variantMatch: false };
    if (xmlSourceId) where.xmlSourceId = xmlSourceId;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { xmlKey: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, sku: true, xmlKey: true, title: true,
          variants: { select: { name: true, value: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const problems = items.map(p => ({
      id: p.id,
      sku: p.sku,
      xmlKey: p.xmlKey,
      title: p.title,
      variantCount: p.variants.length,
      missingAttributes: ['Renk', 'Beden', 'Numara'].filter(attr => !p.variants.some(v => v.name === attr)),
      severity: p.variants.length === 0 ? 'high' : 'medium',
    }));

    return res.json({ ok: true, items: problems, total });
  } catch (error) {
    console.error('[V5] GET /variants/problems error:', error);
    return res.status(500).json({ ok: false, error: 'Problem listesi alınamadı' });
  }
});

// POST /variants/scan - Tüm ürünleri tara (V5 Pipeline kullanır)
router.post('/scan', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: any, res: any) => {
  try {
    const { xmlSourceId, marketplaceKey } = req.body;
    const result = await runV5Pipeline(xmlSourceId || undefined);

    // Pipeline sonrası Workflow cascade'ini tetikle
    const matchedProductIds = result.decisions
      .filter(d => d.status === 'AUTO_APPROVED' || d.status === 'AUTO_CREATED')
      .map(d => d.productId);
    if (matchedProductIds.length > 0) {
      EventBus.emit({
        type: 'VariantMatchChanged',
        correlationId: createCorrelationId('WF'),
        timestamp: new Date().toISOString(),
        source: 'VariantEngineV5',
        data: {
          productIds: matchedProductIds,
          productCount: matchedProductIds.length,
          oldValue: false,
          newValue: true,
          source: 'auto',
        },
      });
    }

    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[V5] POST /variants/scan error:', error);
    return res.status(500).json({ ok: false, error: 'Tarama başarısız' });
  }
});

// POST /variants/auto-match - Otomatik eşleştirme
router.post('/auto-match', requireAuth, async (req: any, res: any) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'productIds array gerekli' });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true, sku: true, xmlKey: true, title: true,
        variants: { select: { name: true, value: true } },
      },
    });

    const preview: Array<{ productId: string; parentSku: string; groupId: string; confidence: number }> = [];
    let matched = 0;
    let failed = 0;

    for (const product of products) {
      const parentSku = product.sku ? product.sku.split(/[-_\s]+/)[0] : product.xmlKey.split(/[-_\s]+/)[0];
      if (!parentSku) { failed++; continue; }

      const confidence = product.variants.length > 0 ? 90 : 75;
      preview.push({
        productId: product.id,
        parentSku,
        groupId: `V5_AUTO_${Date.now()}_${product.id.substring(0, 6)}`,
        confidence,
      });
      matched++;
    }

    return res.json({ ok: true, matched, failed, preview });
  } catch (error) {
    console.error('[V5] POST /variants/auto-match error:', error);
    return res.status(500).json({ ok: false, error: 'Otomatik eşleştirme başarısız' });
  }
});

// POST /variants/confirm-match - Otomatik eşleştirmeyi onayla
router.post('/confirm-match', requireAuth, async (req: any, res: any) => {
  try {
    const { matches } = req.body;
    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ ok: false, error: 'matches array gerekli' });
    }

    const updatedIds: string[] = [];
    for (const match of matches) {
      const { productId } = match;
      if (!productId) continue;

      await prisma.product.update({
        where: { id: productId },
        data: { variantMatch: true },
      });
      updatedIds.push(productId);
    }

    await prisma.auditLog.create({
      data: {
        action: 'V5_CONFIRM_MATCH',
        entity: 'variant',
        details: `V5 otomatik eşleştirme onayı: ${updatedIds.length} ürün`,
        actorUserId: req.actor?.userId || null,
      },
    });

    // Workflow cascade'ini tetikle
    if (updatedIds.length > 0) {
      EventBus.emit({
        type: 'VariantMatchChanged',
        correlationId: createCorrelationId('WF'),
        timestamp: new Date().toISOString(),
        source: 'VariantEngineV5',
        data: {
          productIds: updatedIds,
          productCount: updatedIds.length,
          oldValue: false,
          newValue: true,
          source: 'manual',
        },
      });
    }

    return res.json({ ok: true, totalUpdated: updatedIds.length });
  } catch (error) {
    console.error('[V5] POST /variants/confirm-match error:', error);
    return res.status(500).json({ ok: false, error: 'Onaylama başarısız' });
  }
});

// POST /variants/manual-match - Manuel eşleştirme
router.post('/manual-match', requireAuth, async (req: any, res: any) => {
  try {
    const { matches } = req.body;
    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ ok: false, error: 'matches array gerekli' });
    }

    const allUpdatedIds: string[] = [];
    for (const match of matches) {
      const { productIds } = match;
      if (!Array.isArray(productIds)) continue;

      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { variantMatch: true },
      });
      allUpdatedIds.push(...productIds);
    }

    await prisma.auditLog.create({
      data: {
        action: 'V5_MANUAL_MATCH',
        entity: 'variant',
        details: `V5 manuel eşleştirme: ${allUpdatedIds.length} ürün`,
        actorUserId: req.actor?.userId || null,
      },
    });

    // Workflow cascade'ini tetikle
    if (allUpdatedIds.length > 0) {
      EventBus.emit({
        type: 'VariantMatchChanged',
        correlationId: createCorrelationId('WF'),
        timestamp: new Date().toISOString(),
        source: 'VariantEngineV5',
        data: {
          productIds: allUpdatedIds,
          productCount: allUpdatedIds.length,
          oldValue: false,
          newValue: true,
          source: 'manual',
        },
      });
    }

    return res.json({ ok: true, totalUpdated: allUpdatedIds.length });
  } catch (error) {
    console.error('[V5] POST /variants/manual-match error:', error);
    return res.status(500).json({ ok: false, error: 'Manuel eşleştirme başarısız' });
  }
});

// POST /variants/approve - Seçilen ürünleri onayla
router.post('/approve', requireAuth, async (req: any, res: any) => {
  try {
    const { productIds, groupId, parentSku } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'productIds array gerekli' });
    }

    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { variantMatch: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'V5_APPROVE',
        entity: 'variant',
        details: `V5 onay: ${productIds.length} ürün, grup: ${groupId || 'yok'}, parent: ${parentSku || 'yok'}`,
        actorUserId: req.actor?.userId || null,
      },
    });

    // Workflow cascade'ini tetikle
    EventBus.emit({
      type: 'VariantMatchChanged',
      correlationId: createCorrelationId('WF'),
      timestamp: new Date().toISOString(),
      source: 'VariantEngineV5',
      data: {
        productIds,
        productCount: productIds.length,
        oldValue: false,
        newValue: true,
        source: 'manual',
      },
    });

    return res.json({ ok: true, updated: productIds.length });
  } catch (error) {
    console.error('[V5] POST /variants/approve error:', error);
    return res.status(500).json({ ok: false, error: 'Onaylama başarısız' });
  }
});

// POST /variants/reanalyze - Seçilen ürünleri yeniden analiz et
router.post('/reanalyze', requireAuth, async (req: any, res: any) => {
  try {
    const { productIds, marketplaceKey } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'productIds array gerekli' });
    }

    // Her ürün için V5 kararını yeniden çalıştır
    let analyzed = 0;
    let errors = 0;

    for (const productId of productIds) {
      try {
        await decideProductById(productId);
        analyzed++;
      } catch {
        errors++;
      }
    }

    return res.json({
      ok: true,
      analyzed,
      errors,
      stats: {
        totalProducts: analyzed + errors,
        autoCreated: analyzed,
        autoSuggest: 0,
        manualReview: errors,
        errors: 0,
        xmlVariant: 0,
      },
    });
  } catch (error) {
    console.error('[V5] POST /variants/reanalyze error:', error);
    return res.status(500).json({ ok: false, error: 'Yeniden analiz başarısız' });
  }
});

// GET /variants/thresholds - Eşik değerlerini getir
router.get('/thresholds', requireAuth, async (_req: any, res: any) => {
  try {
    const items = await prisma.variantThreshold.findMany({
      orderBy: { key: 'asc' },
    });
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.key] = item.value;
    }
    const defaults: Record<string, number> = {
      auto_accept: 95,
      auto_suggest: 80,
      manual: 0,
    };
    return res.json({ ok: true, items: { ...defaults, ...map } });
  } catch (error) {
    console.error('[V5] GET /variants/thresholds error:', error);
    return res.status(500).json({ ok: false, error: 'Eşik değerleri alınamadı' });
  }
});

// PUT /variants/thresholds - Eşik değerlerini güncelle
router.put('/thresholds', requireAuth, async (req: any, res: any) => {
  try {
    const thresholds = req.body;
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({ ok: false, error: 'thresholds body olarak gönderilmelidir' });
    }

    const allowedKeys = ['auto_accept', 'auto_suggest', 'manual'];
    const updated: Record<string, number> = {};

    for (const key of allowedKeys) {
      if (thresholds[key] !== undefined) {
        const value = Number(thresholds[key]);
        if (isNaN(value) || value < 0 || value > 100) {
          return res.status(400).json({
            ok: false,
            error: `${key} değeri 0-100 arasında olmalıdır`,
          });
        }
        await prisma.variantThreshold.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
        updated[key] = value;
      }
    }

    const items = await prisma.variantThreshold.findMany({ orderBy: { key: 'asc' } });
    const map: Record<string, number> = {};
    for (const item of items) map[item.key] = item.value;
    const defaults: Record<string, number> = { auto_accept: 95, auto_suggest: 80, manual: 0 };

    return res.json({ ok: true, items: { ...defaults, ...map }, updated });
  } catch (error) {
    console.error('[V5] PUT /variants/thresholds error:', error);
    return res.status(500).json({ ok: false, error: 'Eşik değerleri güncellenemedi' });
  }
});

export default router;
