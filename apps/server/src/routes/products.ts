import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';

const router = Router();

// ==================== ÜRÜN İSTATİSTİK (Cache'li) ====================

let _productsStatsCache: { data: any; timestamp: number } | null = null;
const _PRODUCTS_STATS_CACHE_TTL = 30_000; // 30 saniye

// GET /products/stats - Ürün Havuzu KPI istatistikleri
// NOT: Kategori/Marka/Varyant sayıları, Preparation sekmeleriyle tutarlı olmalıdır.
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    // Cache kontrol
    const cached = _productsStatsCache;
    if (cached && Date.now() - cached.timestamp < _PRODUCTS_STATS_CACHE_TTL) {
      return res.json(cached.data);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalProducts,
      activeProducts,
      passiveProducts,
      draftProducts,
      readyProducts,
      errorProducts,
      newToday,
      updatedToday,
      deletedToday,
      pendingCategory,    // categoryId IS NULL → Kategori Hazırlama ile tutarlı
      pendingBrand,       // brandMatch IS FALSE → Marka Hazırlama ile tutarlı
      pendingVariant,     // variantMatch IS FALSE → Varyant Hazırlama V1 ile tutarlı
      missingImages,
      missingBarcode,
      missingDescription,
      missingPrice,
      missingStock,
      missingSeo,
      templatePending,
      variantAnalysisPending, // V2 sistemi: manuel inceleme + hatalı
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: 'READY' } }),
      prisma.product.count({ where: { status: 'PASSIVE' } }),
      prisma.product.count({ where: { status: 'DRAFT' } }),
      prisma.product.count({ where: { status: 'READY', categoryMatch: true, brandMatch: true, templateMatch: true } }),
      prisma.product.count({ where: { status: 'ERROR' } }),
      prisma.product.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.product.count({ where: { updatedAt: { gte: todayStart } } }),
      0, // Silinen ürünler (şu an için audit log'dan alınabilir)
      prisma.product.count({ where: { categoryId: null } }), // Kategori Hazırlama ile aynı sorgu
      prisma.product.count({ where: { brandMatch: false } }), // Marka Hazırlama ile aynı sorgu
      prisma.product.count({ where: { variantMatch: false } }), // Varyant V1 ile tutarlı
      prisma.product.count({ where: { images: null } }),
      prisma.product.count({ where: { barcode: null } }),
      prisma.product.count({ where: { description: null } }),
      prisma.product.count({ where: { salePrice: null } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.product.count({ where: { seoTitle: null, seoDescription: null } }),
      prisma.product.count({ where: { templateMatch: false } }),
      // Varyant Motoru V2'ye göre bekleyen ürünler (manuel inceleme + hatalı)
      prisma.variantAnalysis.count({
        where: { status: { in: ['NEEDS_REVIEW', 'MANUAL_REQUIRED', 'ERROR'] } },
      }),
    ]);

    const responseData = {
      totalProducts,
      activeProducts,
      passiveProducts,
      draftProducts,
      newProducts: newToday,
      updatedCount: updatedToday,
      deletedCount: deletedToday,
      readyForListing: readyProducts,
      missingInfo: totalProducts - readyProducts,
      pendingCategory,
      pendingBrand,
      pendingVariant,
      pendingTemplate: templatePending,
      variantAnalysisPending,
      missingImages,
      missingBarcode,
      missingDescription,
      missingPrice,
      missingStock,
      missingSeo,
      errorProducts,
    };

    // Cache'e yaz
    _productsStatsCache = { data: responseData, timestamp: Date.now() };

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch product stats' } });
  }
});

// ==================== ÜRÜN LİSTELEME (Gelişmiş Filtreleme) ====================

// GET /products - List products with advanced filtering
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const searchField = String(req.query?.searchField ?? '').trim();
    const categoryId = req.query?.categoryId ? String(req.query.categoryId) : null;
    const brandId = req.query?.brandId ? String(req.query.brandId) : null;
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : null;
    const company = req.query?.company ? String(req.query.company).trim() : null;
    const status = req.query?.status ? String(req.query.status) : null;
    const lowStock = req.query?.lowStock === 'true';
    const hasImage = req.query?.hasImage === 'true' ? true : req.query?.hasImage === 'false' ? false : null;
    const hasBarcode = req.query?.hasBarcode === 'true' ? true : req.query?.hasBarcode === 'false' ? false : null;
    const hasDescription = req.query?.hasDescription === 'true' ? true : req.query?.hasDescription === 'false' ? false : null;
    const categoryMatch = req.query?.categoryMatch === 'true' ? true : req.query?.categoryMatch === 'false' ? false : null;
    const brandMatch = req.query?.brandMatch === 'true' ? true : req.query?.brandMatch === 'false' ? false : null;
    const variantMatch = req.query?.variantMatch === 'true' ? true : req.query?.variantMatch === 'false' ? false : null;
    const minPrice = req.query?.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query?.maxPrice ? Number(req.query.maxPrice) : null;
    const minStock = req.query?.minStock ? Number(req.query.minStock) : null;
    const maxStock = req.query?.maxStock ? Number(req.query.maxStock) : null;
    const dateFrom = req.query?.dateFrom ? new Date(String(req.query.dateFrom)) : null;
    const dateTo = req.query?.dateTo ? new Date(String(req.query.dateTo)) : null;
    const sortBy = String(req.query?.sortBy ?? 'createdAt');
    const sortOrder = String(req.query?.sortOrder ?? 'desc');

    const page = Math.max(1, Number(req.query?.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query?.limit ?? 50)));
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    // Gelişmiş arama
    if (search) {
      if (searchField === 'title') {
        where.title = { contains: search };
      } else if (searchField === 'sku') {
        where.sku = { contains: search };
      } else if (searchField === 'barcode') {
        where.barcode = { contains: search };
      } else if (searchField === 'xmlKey') {
        where.xmlKey = { contains: search };
      } else if (searchField === 'description') {
        where.description = { contains: search };
      } else {
        // Tüm alanlarda ara
        where.OR = [
          { title: { contains: search } },
          { xmlKey: { contains: search } },
          { sku: { contains: search } },
          { barcode: { contains: search } },
          { description: { contains: search } },
        ];
      }
    }

    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (xmlSourceId) where.xmlSourceId = xmlSourceId;
    if (company) where.xmlSource = { company: { contains: company } };
    if (status) where.status = status;
    if (lowStock) where.stock = { lte: 0 };
    if (minStock != null) where.stock = { ...(where.stock || {}), gte: minStock };
    if (maxStock != null) where.stock = { ...(where.stock || {}), lte: maxStock };
    if (minPrice != null) where.salePrice = { ...(where.salePrice || {}), gte: minPrice };
    if (maxPrice != null) where.salePrice = { ...(where.salePrice || {}), lte: maxPrice };
    if (dateFrom) where.createdAt = { ...(where.createdAt || {}), gte: dateFrom };
    if (dateTo) where.createdAt = { ...(where.createdAt || {}), lte: dateTo };

    // Boolean filtreler
    if (hasImage === true) where.images = { not: null };
    if (hasImage === false) where.images = null;
    if (hasBarcode === true) where.barcode = { not: null };
    if (hasBarcode === false) where.barcode = null;
    if (hasDescription === true) where.description = { not: null };
    if (hasDescription === false) where.description = null;
    if (categoryMatch !== null) where.categoryMatch = categoryMatch;
    if (brandMatch !== null) where.brandMatch = brandMatch;
    if (variantMatch !== null) where.variantMatch = variantMatch;

    // Sıralama
    const orderBy: Record<string, string> = {};
    const validSortFields = ['createdAt', 'updatedAt', 'title', 'stock', 'salePrice', 'profitMargin', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    orderBy[sortField] = sortOrder === 'asc' ? 'asc' : 'desc';

    // PERFORMANCE: Sadece gerekli alanları getir (select), ilişkileri lazy yükle
    const includeVariants = req.query?.includeVariants === 'true';
    const minimal = req.query?.minimal === 'true';
    const withPricing = req.query?.withPricing === 'true';

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: minimal ? {
          id: true, title: true, sku: true, barcode: true,
          salePrice: true, purchasePrice: true, stock: true, status: true,
          images: true, xmlKey: true, vatRate: true, profitMargin: true,
          categoryId: true, brandId: true,
          categoryMatch: true, brandMatch: true, variantMatch: true, templateMatch: true,
          createdAt: true, updatedAt: true,
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          xmlSource: { select: { id: true, name: true, company: true } },
          ...(includeVariants ? { variants: { select: { id: true, name: true, value: true } } } : {}),
        } : {
          id: true, title: true, sku: true, barcode: true, xmlKey: true,
          salePrice: true, purchasePrice: true, stock: true, status: true,
          images: true, description: true, seoTitle: true, seoDescription: true,
          vatRate: true, commissionRate: true, profitMargin: true, discount: true,
          categoryId: true, brandId: true, xmlSourceId: true,
          categoryMatch: true, brandMatch: true, variantMatch: true, templateMatch: true,
          unit: true, currency: true, tags: true, errorMessage: true,
          createdAt: true, updatedAt: true,
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          xmlSource: { select: { id: true, name: true, company: true } },
          ...(includeVariants ? { variants: { select: { id: true, name: true, value: true } } } : {}),
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Fiyat hesaplama: purchasePrice yoksa salePrice baz al, varsa hesapla
    const itemsWithPricing = items.map(item => {
      const basePrice = item.purchasePrice || item.salePrice || 0;
      const vat = item.vatRate || 20;
      const margin = item.profitMargin || 30;
      const vatAmount = basePrice * (vat / 100);
      const totalCost = basePrice + vatAmount;
      const profitAmount = totalCost * (margin / 100);
      const calculatedPrice = Math.max(Math.ceil((totalCost + profitAmount) / 100) * 100 - 1, basePrice * 1.05);
      return { ...item, calculatedPrice };
    });

    res.json({
      items: itemsWithPricing,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch products' } });
  }
});

// ==================== TOPLU İŞLEMLER ====================

// POST /products/bulk-update - Toplu ürün güncelleme
router.post('/bulk-update', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { ids, updates } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ids array is required' } });
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'updates object is required' } });
    }

    // İzin verilen güncelleme alanları
    const allowedFields = [
      'status', 'categoryId', 'brandId', 'salePrice', 'vatRate',
      'profitMargin', 'minProfit', 'discount', 'commissionRate',
      'title', 'description', 'seoTitle', 'seoDescription',
      'barcode', 'sku', 'stock', 'minStock', 'unit', 'currency',
    ];

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        data[key] = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No valid update fields provided' } });
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'product.bulk.update',
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        meta: JSON.stringify({
          count: result.count,
          ids,
          updates,
        }),
      },
    });

    res.json({
      ok: true,
      updatedCount: result.count,
      message: `${result.count} ürün güncellendi`,
    });
  } catch (error) {
    console.error('Error bulk updating products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to bulk update products' } });
  }
});

// POST /products/bulk-delete - Toplu ürün silme
router.post('/bulk-delete', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ids array is required' } });
    }

    // Önce ilişkili kayıtları temizle
    await prisma.variant.deleteMany({ where: { productId: { in: ids } } });
    await prisma.productMarketplaceState.deleteMany({ where: { productId: { in: ids } } });

    const result = await prisma.product.deleteMany({
      where: { id: { in: ids } },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'product.bulk.delete',
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        meta: JSON.stringify({
          count: result.count,
          ids,
        }),
      },
    });

    res.json({
      ok: true,
      deletedCount: result.count,
      message: `${result.count} ürün silindi`,
    });
  } catch (error) {
    console.error('Error bulk deleting products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to bulk delete products' } });
  }
});

// ==================== ANALİZ VE HAZIRLIK ====================

// POST /products/analyze - AI analiz ve kalite skoru hesaplama
router.post('/analyze', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ids array is required' } });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      include: { category: true, brand: true, variants: true },
    });

    const results = [];

    for (const product of products) {
      // Kalite skoru hesapla (100 üzerinden)
      let score = 0;
      const details: Record<string, { score: number; max: number; status: string }> = {};

      // Başlık (10 puan)
      if (product.title && product.title.length >= 10) {
        score += 10;
        details.title = { score: 10, max: 10, status: 'complete' };
      } else if (product.title) {
        score += 5;
        details.title = { score: 5, max: 10, status: 'partial' };
      } else {
        details.title = { score: 0, max: 10, status: 'missing' };
      }

      // Açıklama (15 puan)
      if (product.description && product.description.length >= 50) {
        score += 15;
        details.description = { score: 15, max: 15, status: 'complete' };
      } else if (product.description) {
        score += 7;
        details.description = { score: 7, max: 15, status: 'partial' };
      } else {
        details.description = { score: 0, max: 15, status: 'missing' };
      }

      // Resim (15 puan)
      const imageCount = product.images ? product.images.split(',').filter(Boolean).length : 0;
      if (imageCount >= 3) {
        score += 15;
        details.images = { score: 15, max: 15, status: 'complete' };
      } else if (imageCount >= 1) {
        score += 8;
        details.images = { score: 8, max: 15, status: 'partial' };
      } else {
        details.images = { score: 0, max: 15, status: 'missing' };
      }

      // Kategori (10 puan)
      if (product.categoryMatch && product.categoryId) {
        score += 10;
        details.category = { score: 10, max: 10, status: 'complete' };
      } else {
        details.category = { score: 0, max: 10, status: 'missing' };
      }

      // Marka (10 puan)
      if (product.brandMatch && product.brandId) {
        score += 10;
        details.brand = { score: 10, max: 10, status: 'complete' };
      } else {
        details.brand = { score: 0, max: 10, status: 'missing' };
      }

      // Barkod (10 puan)
      if (product.barcode) {
        score += 10;
        details.barcode = { score: 10, max: 10, status: 'complete' };
      } else {
        details.barcode = { score: 0, max: 10, status: 'missing' };
      }

      // Varyant (5 puan)
      if (product.variantMatch && product.variants.length > 0) {
        score += 5;
        details.variant = { score: 5, max: 5, status: 'complete' };
      } else {
        details.variant = { score: 0, max: 5, status: 'missing' };
      }

      // SEO (10 puan)
      const hasSeo = !!(product.seoTitle || product.seoDescription);
      if (hasSeo) {
        score += 10;
        details.seo = { score: 10, max: 10, status: 'complete' };
      } else {
        details.seo = { score: 0, max: 10, status: 'missing' };
      }

      // Öznitelikler (5 puan)
      if (product.technicalSpecs) {
        score += 5;
        details.attributes = { score: 5, max: 5, status: 'complete' };
      } else {
        details.attributes = { score: 0, max: 5, status: 'missing' };
      }

      // Stok (10 puan)
      if (product.stock > 0) {
        score += 10;
        details.stock = { score: 10, max: 10, status: 'complete' };
      } else {
        details.stock = { score: 0, max: 10, status: 'missing' };
      }

      // Kalite skorunu güncelle
      await prisma.product.update({
        where: { id: product.id },
        data: { aiScore: score },
      });

      results.push({
        id: product.id,
        title: product.title,
        score,
        details,
        level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
      });
    }

    res.json({
      ok: true,
      analyzed: results.length,
      results,
    });
  } catch (error) {
    console.error('Error analyzing products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze products' } });
  }
});

// POST /products/prepare - Listelemeye hazırla
router.post('/prepare', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { ids, marketplaceId, templateId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ids array is required' } });
    }

    if (!marketplaceId) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'marketplaceId is required' } });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      include: { marketplaceStates: true },
    });

    const results = [];

    for (const product of products) {
      // Eksik bilgi kontrolü
      const issues: string[] = [];
      if (!product.categoryMatch) issues.push('Kategori eşleşmemiş');
      if (!product.brandMatch) issues.push('Marka eşleşmemiş');
      if (!product.barcode) issues.push('Barkod eksik');
      if (!product.images) issues.push('Resim eksik');
      if (!product.description) issues.push('Açıklama eksik');
      if (product.stock <= 0) issues.push('Stok yok');
      if (!product.salePrice || product.salePrice <= 0) issues.push('Satış fiyatı eksik');

      // Mevcut state'i bul veya oluştur
      let state = product.marketplaceStates.find(s => s.marketplaceId === marketplaceId);

      if (issues.length === 0) {
        // Hazır, state güncelle
        if (state) {
          await prisma.productMarketplaceState.update({
            where: { id: state.id },
            data: { status: 'READY', lastActionAt: new Date() },
          });
        } else {
          state = await prisma.productMarketplaceState.create({
            data: {
              productId: product.id,
              marketplaceId,
              status: 'READY',
              price: product.salePrice,
              stock: product.stock,
              lastActionAt: new Date(),
            },
          });
        }
        results.push({ id: product.id, title: product.title, status: 'ready', issues: [] });
      } else {
        // Eksik bilgi var, state güncelle
        if (state) {
          await prisma.productMarketplaceState.update({
            where: { id: state.id },
            data: { status: 'ERROR', errorMessage: issues.join(', '), lastActionAt: new Date() },
          });
        } else {
          await prisma.productMarketplaceState.create({
            data: {
              productId: product.id,
              marketplaceId,
              status: 'ERROR',
              errorMessage: issues.join(', '),
              lastActionAt: new Date(),
            },
          });
        }
        results.push({ id: product.id, title: product.title, status: 'incomplete', issues });
      }
    }

    // Audit log
    const readyCount = results.filter(r => r.status === 'ready').length;
    await prisma.auditLog.create({
      data: {
        action: 'product.bulk.prepare',
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        meta: JSON.stringify({
          total: results.length,
          readyCount,
          incompleteCount: results.length - readyCount,
          marketplaceId,
        }),
      },
    });

    res.json({
      ok: true,
      prepared: results.length,
      readyCount,
      incompleteCount: results.length - readyCount,
      results,
    });
  } catch (error) {
    console.error('Error preparing products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to prepare products' } });
  }
});

// ==================== TEK KAYIT CRUD ====================

// GET /products/:id - Get single product with full details
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        variants: true,
        xmlSource: { select: { id: true, name: true, company: true } },
        marketplaceStates: {
          include: { marketplace: { select: { id: true, name: true, key: true } } },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    return res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch product' } });
  }
});

// POST /products - Create new product
router.post('/', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  const xmlKey = String(req.body?.xmlKey ?? '').trim();
  const title = req.body?.title !== undefined ? String(req.body.title).trim() : null;
  const sku = req.body?.sku !== undefined ? String(req.body.sku).trim() : null;
  const barcode = req.body?.barcode !== undefined ? String(req.body.barcode).trim() : null;
  const stock = Number(req.body?.stock ?? 0);
  const minStock = Number(req.body?.minStock ?? 0);

  if (!xmlKey) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'xmlKey zorunludur' } });
  }

  try {
    const created = await prisma.product.create({
      data: {
        xmlKey,
        title,
        sku,
        barcode,
        stock: Number.isFinite(stock) ? stock : 0,
        minStock: Number.isFinite(minStock) ? minStock : 0,
      },
    });
    return res.status(201).json({ ok: true, item: created });
  } catch {
    return res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'Product xmlKey zaten kayıtlı olabilir' } });
  }
});

// PUT /products/:id - Update product
router.put('/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  const id = String(req.params.id ?? '');
  if (!id) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'id zorunludur' } });
  }

  const allowedFields = [
    'title', 'sku', 'barcode', 'stock', 'minStock', 'salePrice', 'purchasePrice',
    'vatRate', 'profitMargin', 'minProfit', 'discount', 'commissionRate',
    'description', 'detail', 'seoTitle', 'seoDescription', 'technicalSpecs',
    'images', 'link', 'unit', 'currency', 'status', 'categoryId', 'brandId',
    'categoryMatch', 'brandMatch', 'variantMatch', 'templateMatch',
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (req.body?.[field] !== undefined) {
      data[field] = req.body[field];
    }
  }

  try {
    const updated = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
    return res.json({ ok: true, item: updated });
  } catch {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Product bulunamadı' } });
  }
});

// DELETE /products/:id - Delete product
router.delete('/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  const id = String(req.params.id ?? '');
  if (!id) {
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'id zorunludur' } });
  }

  try {
    // İlişkili kayıtları temizle
    await prisma.variant.deleteMany({ where: { productId: id } });
    await prisma.productMarketplaceState.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: 'product.delete',
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        meta: JSON.stringify({ productId: id }),
      },
    });

    return res.json({ ok: true });
  } catch {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Product bulunamadı' } });
  }
});

export default router;
