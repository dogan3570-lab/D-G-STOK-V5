import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import { EventBus } from '../services/eventBus/EventBus.ts';
import { createCorrelationId } from '../services/eventBus/events.ts';
import { matchCategory } from '../services/aiEngine.ts';

const router = Router();

// ==================== STATS ====================
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [totalXmlCategories, categorizedProducts, uncategorizedProducts, aiSuggested, manualMatched, errorCategories, totalSystemCategories] = await Promise.all([
      prisma.product.findMany({ where: { supplierCategory: { not: null } }, select: { supplierCategory: true }, distinct: ['supplierCategory'] }),
      prisma.product.count({ where: { categoryId: { not: null } } }),
      prisma.product.count({ where: { categoryId: null } }),
      prisma.product.count({ where: { aiSuggestedCategoryId: { not: null } } }),
      prisma.categoryMapping.count({ where: { source: 'manual' } }),
      prisma.product.count({ where: { errorMessage: { not: null }, categoryMatch: false } }),
      prisma.category.count(),
    ]);
    res.json({
      totalXmlCategories: totalXmlCategories.length,
      matchedCategories: categorizedProducts,
      unmatchedProducts: uncategorizedProducts,
      aiSuggested,
      manualMatched,
      errorCategories,
      totalCategories: totalSystemCategories,
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch category stats' } });
  }
});

// ==================== XML CATEGORIES ====================
router.get('/xml-categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : null;
    const where: any = { supplierCategory: { not: null } };
    if (search) where.supplierCategory = { contains: search };
    if (xmlSourceId) where.xmlSourceId = xmlSourceId;

    const products = await prisma.product.findMany({
      where, select: { supplierCategory: true, xmlSourceId: true, xmlSource: { select: { name: true } } },
      distinct: ['supplierCategory'], orderBy: { supplierCategory: 'asc' },
    });

    const categories = products.map(p => ({ name: p.supplierCategory, sourceName: p.xmlSource?.name || 'Bilinmeyen', sourceId: p.xmlSourceId }));
    const tree: any[] = [];

    for (const cat of categories) {
      if (!cat.name) continue;
      const parts = cat.name.split('>').map((s: string) => s.trim()).filter(Boolean);
      let currentLevel = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const path = parts.slice(0, i + 1).join(' > ');
        let existing = currentLevel.find((n: any) => n.name === part);
        if (!existing) {
          existing = { name: part, fullPath: path, children: [], sourceName: cat.sourceName, sourceId: cat.sourceId, productCount: 0 };
          currentLevel.push(existing);
        }
        if (i === parts.length - 1) existing.productCount++;
        currentLevel = existing.children;
      }
    }
    res.json({ items: tree, flat: categories });
  } catch (error) {
    console.error('Error fetching XML categories:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch XML categories' } });
  }
});

// ==================== SYSTEM CATEGORIES (TREE) ====================
router.get('/tree', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const marketplaceId = req.query?.marketplaceId ? String(req.query.marketplaceId) : null;
    const where: any = {};
    if (search) where.name = { contains: search };

    // Pazaryeri filtresi: o pazaryerine ait kategori mapping'lerinden kategori ID'lerini bul
    let marketplaceCategoryIds: string[] | null = null;
    if (marketplaceId) {
      const mappings = await prisma.categoryMapping.findMany({
        where: { marketplaceId },
        select: { categoryId: true },
      });
      marketplaceCategoryIds = mappings.map(m => m.categoryId);
      if (marketplaceCategoryIds.length > 0) {
        where.id = { in: marketplaceCategoryIds };
      } else {
        // Eğer o pazaryeri için hiç mapping yoksa, tüm kategorileri döndür (ilk kurulum)
      }
    }

    const allCategories = await prisma.category.findMany({ where, orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } });
    const buildTree = (parentId: string | null): any[] => allCategories.filter(c => c.parentId === parentId).map(c => ({ id: c.id, name: c.name, externalId: c.externalId, parentId: c.parentId, productCount: c._count.products, children: buildTree(c.id), createdAt: c.createdAt, updatedAt: c.updatedAt }));
    res.json({ items: buildTree(null), flat: allCategories });
  } catch (error) {
    console.error('Error fetching category tree:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch category tree' } });
  }
});

// ==================== MARKETPLACE CATEGORIES ====================
router.get('/marketplace-categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const marketplaceId = req.query?.marketplaceId ? String(req.query.marketplaceId) : null;
    const where: any = {};
    if (marketplaceId) where.marketplaceId = marketplaceId;
    const mappings = await prisma.categoryMapping.findMany({
      where, include: { category: { select: { id: true, name: true, parentId: true } }, marketplace: { select: { id: true, name: true, key: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const byMarketplace = new Map<string, any>();
    for (const m of mappings) {
      const key = m.marketplaceId || 'unknown';
      if (!byMarketplace.has(key)) byMarketplace.set(key, { marketplaceId: key, marketplaceName: m.marketplace?.name || 'Bilinmeyen', marketplaceKey: m.marketplace?.key || 'unknown', categories: [] });
      byMarketplace.get(key).categories.push(m);
    }
    res.json({ items: Array.from(byMarketplace.values()), flat: mappings });
  } catch (error) {
    console.error('Error fetching marketplace categories:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch marketplace categories' } });
  }
});

// ==================== AI AUTO-MATCH (V2 - AI ENGINE İLE) ====================
const BATCH_SIZE_AI = 500;

router.post('/ai-match', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;
    const where: any = { categoryMatch: false };
    if (Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };

    const totalCount = await prisma.product.count({ where });
    if (totalCount === 0) {
      return res.json({ matchedCount: 0, totalProducts: 0, message: 'Eşleştirilecek ürün bulunamadı', results: [] });
    }

    // Sistem kategorilerini yükle
    const systemCategories = await prisma.category.findMany({
      select: { id: true, name: true, parentId: true },
    });

    let matchedCount = 0;
    let suggestedCount = 0;
    let manualCount = 0;
    const matchResults: Array<{ productId: string; productName: string; suggestedCategory: string | null; confidence: number; reason: string }> = [];
    const toUpdateMatch: Array<{ id: string; categoryId: string; score: number }> = [];
    const toUpdateSuggest: Array<{ id: string; categoryId: string; score: number }> = [];

    // Batch'ler halinde işle
    const totalBatches = Math.ceil(totalCount / BATCH_SIZE_AI);

    for (let batch = 0; batch < totalBatches; batch++) {
      const products = await prisma.product.findMany({
        where,
        select: {
          id: true, title: true, xmlKey: true, supplierCategory: true,
          description: true,
          brand: { select: { name: true } },
          xmlSource: { select: { name: true } },
        },
        skip: batch * BATCH_SIZE_AI,
        take: BATCH_SIZE_AI,
      });

      for (const product of products) {
        // AI Engine ile karar ver
        const result = await matchCategory(
          {
            id: product.id,
            title: product.title,
            xmlKey: product.xmlKey,
            supplierCategory: product.supplierCategory,
            description: product.description,
            brandName: product.brand?.name || null,
            xmlSourceName: product.xmlSource?.name || null,
          },
          systemCategories
        );

        matchResults.push({
          productId: result.productId,
          productName: result.productName,
          suggestedCategory: result.suggestedCategory,
          confidence: result.confidence,
          reason: result.reason,
        });

        if (result.status === 'auto_matched' && result.suggestedCategoryId) {
          toUpdateMatch.push({
            id: result.productId,
            categoryId: result.suggestedCategoryId,
            score: result.confidence,
          });
          matchedCount++;
        } else if (result.status === 'suggested' && result.suggestedCategoryId) {
          toUpdateSuggest.push({
            id: result.productId,
            categoryId: result.suggestedCategoryId,
            score: result.confidence,
          });
          suggestedCount++;
        } else if (result.status === 'manual_review') {
          manualCount++;
        }
      }
    }

    // Toplu güncelleme (auto-match)
    if (toUpdateMatch.length > 0) {
      for (let i = 0; i < toUpdateMatch.length; i += BATCH_SIZE_AI) {
        const batch = toUpdateMatch.slice(i, i + BATCH_SIZE_AI);
        const ids = batch.map(m => m.id);
        await prisma.product.updateMany({
          where: { id: { in: ids } },
          data: { categoryMatch: true, matchedBy: 'ai', lastMatchDate: new Date() },
        });
        for (const m of batch) {
          await prisma.product.update({
            where: { id: m.id },
            data: { categoryId: m.categoryId, aiSuggestedCategoryId: m.categoryId, aiScore: m.score / 100 },
          });
        }
      }
    }

    // Toplu güncelleme (suggested)
    if (toUpdateSuggest.length > 0) {
      for (let i = 0; i < toUpdateSuggest.length; i += BATCH_SIZE_AI) {
        const batch = toUpdateSuggest.slice(i, i + BATCH_SIZE_AI);
        for (const m of batch) {
          await prisma.product.update({
            where: { id: m.id },
            data: { aiSuggestedCategoryId: m.categoryId, aiScore: m.score / 100 },
          });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        action: 'AI_CATEGORY_MATCH',
        entity: 'category',
        meta: JSON.stringify({ matchedCount, suggestedCount, manualCount, totalCount }),
        details: `AI ile ${matchedCount} ürün eşleştirildi, ${suggestedCount} öneri, ${manualCount} manuel inceleme`,
        actorUserId: (req as any).actor?.userId || null,
      },
    });

    // EVENT: AI kategori eşleştirme
    if (matchedCount > 0) {
      const aiCorrelationId = createCorrelationId('WF');
      const aiProductIds = toUpdateMatch.map(m => m.id);
      await EventBus.emit({
        type: 'CategoryMatchChanged',
        correlationId: aiCorrelationId,
        timestamp: new Date().toISOString(),
        source: 'categories.aiMatch',
        data: {
          productIds: aiProductIds,
          productCount: matchedCount,
          oldValue: false,
          newValue: true,
          source: 'ai',
          triggeredBy: (req as any).actor?.userId,
        },
      });
    }

    res.json({
      matchedCount,
      suggestedCount,
      manualCount,
      totalProducts: totalCount,
      message: `${matchedCount} ürün AI ile eşleştirildi, ${suggestedCount} öneri, ${manualCount} manuel inceleme`,
      results: matchResults,
    });
  } catch (error) {
    console.error('Error AI matching categories:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to AI match categories' } });
  }
});

// ==================== BULK OPERATIONS ====================
router.post('/bulk-match', requireAuth, async (req: Request, res: Response) => {
  try {
    const { matches } = req.body;
    if (!Array.isArray(matches) || matches.length === 0) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'matches array is required' } });

    let totalMatched = 0;
    const allProductIds: string[] = [];
    const results: Array<{ xmlCategory: string; systemCategory: string; count: number }> = [];
    for (const match of matches) {
      const { xmlCategoryPath, systemCategoryId } = match;
      const products = await prisma.product.findMany({ where: { supplierCategory: xmlCategoryPath }, select: { id: true } });
      if (products.length > 0 && systemCategoryId) {
        const productIds = products.map(p => p.id);
        allProductIds.push(...productIds);
        await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { categoryId: systemCategoryId, categoryMatch: true } });
        const systemCat = await prisma.category.findUnique({ where: { id: systemCategoryId } });
        totalMatched += products.length;
        results.push({ xmlCategory: xmlCategoryPath, systemCategory: systemCat?.name || 'Bilinmeyen', count: products.length });
      }
    }

    // EVENT: Kategori eşleştirme değişikliğini yayınla
    if (allProductIds.length > 0) {
      const correlationId = createCorrelationId('WF');
      await EventBus.emit({
        type: 'CategoryMatchChanged',
        correlationId,
        timestamp: new Date().toISOString(),
        source: 'categories.bulkMatch',
        data: {
          productIds: allProductIds,
          productCount: allProductIds.length,
          oldValue: false,
          newValue: true,
          source: 'bulk',
          triggeredBy: (req as any).actor?.userId,
        },
      });
    }

    await prisma.auditLog.create({ data: { action: 'BULK_CATEGORY_MATCH', entity: 'category', meta: JSON.stringify({ totalMatched, categoryCount: results.length }), details: `Toplu eşleştirme: ${totalMatched} ürün, ${results.length} kategori`, actorUserId: (req as any).actor?.userId || null } });
    res.json({ matchedCount: totalMatched, results, message: `${totalMatched} ürün toplu olarak eşleştirildi` });
  } catch (error) {
    console.error('Error bulk matching categories:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to bulk match categories' } });
  }
});

// ==================== LIST ALL CATEGORIES ====================
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const parentId = req.query?.parentId ? String(req.query.parentId) : null;
    const where: Record<string, unknown> = {};
    if (search) where.name = { contains: search };
    if (parentId !== undefined) where.parentId = parentId || null;
    const categories = await prisma.category.findMany({ where, orderBy: { name: 'asc' }, include: { _count: { select: { products: true, children: true } } } });
    res.json({ items: categories.map((cat: any) => ({ id: cat.id, name: cat.name, externalId: cat.externalId, parentId: cat.parentId, productCount: cat._count.products, childCount: cat._count.children, createdAt: cat.createdAt, updatedAt: cat.updatedAt })) });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories' } });
  }
});

// ==================== CATEGORIZED PRODUCTS (for category matching page) ====================
router.get('/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const limit = parseInt(String(req.query.limit || '50'));
    const search = String(req.query.search || '').trim();
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : null;
    const uncategorized = req.query?.uncategorized === 'true';
    const categoryIdParam = req.query?.categoryId ? String(req.query.categoryId) : null;
    const status = req.query?.status ? String(req.query.status) : null;
    
    const where: any = {};
    if (uncategorized) where.categoryId = null;
    
    // categoryId filtresi: "not_null" → eşleşenler, belirli bir ID → o kategoridekiler
    if (categoryIdParam === 'not_null') {
      where.categoryId = { not: null };
    } else if (categoryIdParam) {
      where.categoryId = categoryIdParam;
    }
    
    // status filtresi
    if (status) {
      switch (status) {
        case 'XML': where.categoryMatch = false; where.categoryId = null; break;
        case 'DRAFT': where.categoryMatch = false; where.categoryId = { not: null }; break;
        case 'READY': where.categoryMatch = true; break;
        case 'SENT': break; // tümü
        case 'ERROR': where.errorMessage = { not: null }; break;
      }
    }
    
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
    console.error('Error fetching category products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch category products' } });
  }
});

// ==================== UNMATCHED PRODUCTS ====================
router.get('/unmatched-products', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const limit = parseInt(String(req.query.limit || '50'));
    const search = String(req.query.search || '').trim();
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : null;
    const where: any = { categoryMatch: false };
    if (search) where.OR = [{ title: { contains: search } }, { xmlKey: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }];
    if (xmlSourceId) where.xmlSourceId = xmlSourceId;
    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, include: { category: true, brand: { select: { id: true, name: true } }, xmlSource: { select: { id: true, name: true } } }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.product.count({ where }),
    ]);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Error fetching unmatched products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch unmatched products' } });
  }
});

// ==================== MATCH / UNMATCH ====================
router.post('/match', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoryId, productIds } = req.body;
    if (!categoryId || !Array.isArray(productIds) || productIds.length === 0) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'categoryId and productIds array are required' } });
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kategori bulunamadı' } });
    const result = await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { categoryId, categoryMatch: true, matchedBy: 'manual', lastMatchDate: new Date() } });

    // EVENT: Kategori eşleştirme değişikliğini yayınla
    if (result.count > 0) {
      const correlationId = createCorrelationId('WF');
      await EventBus.emit({
        type: 'CategoryMatchChanged',
        correlationId,
        timestamp: new Date().toISOString(),
        source: 'categories.match',
        data: {
          productIds,
          productCount: result.count,
          oldValue: false,
          newValue: true,
          source: 'manual',
          triggeredBy: (req as any).actor?.userId,
        },
      });
    }

    await prisma.auditLog.create({ data: { action: 'CATEGORY_MATCH', entity: 'category', entityId: categoryId, details: `${result.count} ürün "${category.name}" kategorisine eşleştirildi`, actorUserId: (req as any).actor?.userId || null } });
    res.json({ matchedCount: result.count, message: `${result.count} ürün eşleştirildi` });
  } catch (error) {
    console.error('Error matching products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to match products' } });
  }
});

router.post('/unmatch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productIds array is required' } });
    const result = await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { categoryId: null, categoryMatch: false } });

    // EVENT: Kategori eşleştirme kaldırma
    if (result.count > 0) {
      const correlationId = createCorrelationId('WF');
      await EventBus.emit({
        type: 'CategoryMatchChanged',
        correlationId,
        timestamp: new Date().toISOString(),
        source: 'categories.unmatch',
        data: {
          productIds,
          productCount: result.count,
          oldValue: true,
          newValue: false,
          source: 'manual',
          triggeredBy: (req as any).actor?.userId,
        },
      });
    }

    await prisma.auditLog.create({ data: { action: 'CATEGORY_UNMATCH', entity: 'category', details: `${result.count} ürünün kategori eşleştirmesi kaldırıldı`, actorUserId: (req as any).actor?.userId || null } });
    res.json({ unmatchedCount: result.count, message: `${result.count} ürünün eşleştirmesi kaldırıldı` });
  } catch (error) {
    console.error('Error unmatching products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to unmatch products' } });
  }
});

// ==================== CREATE CATEGORY ====================
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, externalId, parentId } = req.body;
    if (!name) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name is required' } });
    const category = await prisma.category.create({ data: { name, externalId: externalId || null, parentId: parentId || null } });
    await prisma.auditLog.create({ data: { action: 'CATEGORY_CREATE', entity: 'category', entityId: category.id, details: `"${name}" kategorisi oluşturuldu`, actorUserId: (req as any).actor?.userId || null } });
    res.status(201).json({ item: category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create category' } });
  }
});

// ==================== MAPPINGS ====================
router.get('/mappings', requireAuth, async (req: Request, res: Response) => {
  try {
    const marketplaceId = req.query?.marketplaceId ? String(req.query.marketplaceId) : null;
    const source = req.query?.source ? String(req.query.source) : null;
    const where: Record<string, unknown> = {};
    if (marketplaceId) where.marketplaceId = marketplaceId;
    if (source) where.source = source;
    const mappings = await prisma.categoryMapping.findMany({ where, include: { category: { select: { id: true, name: true, parentId: true } }, marketplace: { select: { id: true, name: true, key: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ items: mappings });
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch mappings' } });
  }
});

router.post('/mappings', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoryId, marketplaceId, externalId, externalName, externalPath, source, confidence } = req.body;
    if (!categoryId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'categoryId is required' } });
    const mapping = await prisma.categoryMapping.create({ data: { categoryId, marketplaceId: marketplaceId || null, externalId: externalId || null, externalName: externalName || null, externalPath: externalPath || null, source: source || 'manual', confidence: confidence || null } });
    res.status(201).json(mapping);
  } catch (error) {
    console.error('Error creating mapping:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create mapping' } });
  }
});

router.put('/mappings/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { externalId, externalName, externalPath, active, confidence } = req.body;
    const data: Record<string, unknown> = {};
    if (externalId !== undefined) data.externalId = externalId;
    if (externalName !== undefined) data.externalName = externalName;
    if (externalPath !== undefined) data.externalPath = externalPath;
    if (active !== undefined) data.active = active;
    if (confidence !== undefined) data.confidence = confidence;
    const mapping = await prisma.categoryMapping.update({ where: { id }, data });
    res.json(mapping);
  } catch (error) {
    console.error('Error updating mapping:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update mapping' } });
  }
});

router.delete('/mappings/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.categoryMapping.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting mapping:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete mapping' } });
  }
});

// ==================== LOGS ====================
router.get('/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where: { entity: 'category' }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { actorUser: { select: { email: true, name: true } } } }),
      prisma.auditLog.count({ where: { entity: 'category' } }),
    ]);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Error fetching category logs:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch category logs' } });
  }
});

// ==================== CATEGORY MOVE (Drag & Drop) ====================
router.put('/:id/move', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newParentId } = req.body;
    if (newParentId === id) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Bir kategori kendi altına taşınamaz' } });
    const category = await prisma.category.update({ where: { id }, data: { parentId: newParentId || null } });
    res.json({ item: category });
  } catch (error) {
    console.error('Error moving category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to move category' } });
  }
});

// ==================== UPDATE / DELETE CATEGORY (must be last) ====================
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, externalId, parentId } = req.body;
    const oldCategory = await prisma.category.findUnique({ where: { id } });
    const category = await prisma.category.update({ where: { id }, data: { ...(name !== undefined ? { name } : {}), ...(externalId !== undefined ? { externalId: externalId || null } : {}), ...(parentId !== undefined ? { parentId: parentId || null } : {}) } });
    await prisma.auditLog.create({ data: { action: 'CATEGORY_UPDATE', entity: 'category', entityId: id, details: `"${oldCategory?.name}" → "${category.name}" olarak güncellendi`, actorUserId: (req as any).actor?.userId || null } });
    res.json({ item: category });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update category' } });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({ where: { id } });
    await prisma.category.updateMany({ where: { parentId: id }, data: { parentId: null } });
    await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null, categoryMatch: false } });
    await prisma.categoryMapping.deleteMany({ where: { categoryId: id } });
    await prisma.category.delete({ where: { id } });
    await prisma.auditLog.create({ data: { action: 'CATEGORY_DELETE', entity: 'category', entityId: id, details: `"${category?.name}" kategorisi silindi`, actorUserId: (req as any).actor?.userId || null } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete category' } });
  }
});

export default router;
