// ==================== LİSTELME ŞABLONU V3 ENTERPRISE ROUTES ====================
import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import {
  calculatePrice,
  renderTitle,
  renderDescription,
  validateProduct,
  simulatePrices,
  generatePreview,
  generateBarcode,
  calculateStock,
  getForbiddenWords,
  type PriceRangeRule,
  type ExcludeRules,
  type DescriptionBlock,
  type ValidationConfig,
} from '../services/listingEngine.ts';

const router = Router();

// ==================== 1. TEMEL CRUD ====================

// Tüm şablonları listele
router.get('/', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const items = await prisma.listingTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        marketplace: { select: { id: true, name: true, key: true } },
      },
    });
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// Tek şablon getir
router.get('/:id', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const item = await prisma.listingTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        marketplace: { select: { id: true, name: true, key: true } },
      },
    });
    if (!item) return res.status(404).json({ ok: false, error: 'Şablon bulunamadı' });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// Yeni şablon oluştur
router.post('/', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: AuthedRequest, res: any) => {
  try {
    const data = req.body;
    const item = await prisma.listingTemplate.create({
      data: {
        name: data.name || 'Şablon',
        marketplaceId: data.marketplaceId || null,
        productId: data.productId || null,
        titleFormat: data.titleFormat || null,
        description: data.description || null,
        priceFormula: data.priceFormula || null,
        commissionRate: data.commissionRate ? Number(data.commissionRate) : null,
        vatRate: data.vatRate ? Number(data.vatRate) : null,
        cargoSettings: data.cargoSettings || null,
        imageSettings: data.imageSettings || null,
        variantSettings: data.variantSettings || null,
        categoryId: data.categoryId || null,
        brandId: data.brandId || null,
        active: data.active !== false,

        // V3 fields
        priceSource: data.priceSource || 'XML_PURCHASE',
        vatMode: data.vatMode || 'INCLUDED',
        priceMultiplier: data.priceMultiplier ? Number(data.priceMultiplier) : 1.0,
        priceFixedAmount: data.priceFixedAmount ? Number(data.priceFixedAmount) : 0,
        priceRangeRules: data.priceRangeRules || null,
        excludeRules: data.excludeRules || null,
        titleVariables: data.titleVariables || null,
        titleMaxLength: data.titleMaxLength ? Number(data.titleMaxLength) : null,
        titleSeoMaxLength: data.titleSeoMaxLength ? Number(data.titleSeoMaxLength) : null,
        descriptionBlocks: data.descriptionBlocks || null,
        descriptionMaxLength: data.descriptionMaxLength ? Number(data.descriptionMaxLength) : null,
        imageMinCount: data.imageMinCount ? Number(data.imageMinCount) : null,
        imageMaxCount: data.imageMaxCount ? Number(data.imageMaxCount) : null,
        imageOrder: data.imageOrder || null,
        imageWatermark: data.imageWatermark || null,
        imageBackground: data.imageBackground || null,
        imageMinSize: data.imageMinSize ? Number(data.imageMinSize) : null,
        imageFormat: data.imageFormat || null,
        stockMultiplier: data.stockMultiplier ? Number(data.stockMultiplier) : null,
        stockMinValue: data.stockMinValue ? Number(data.stockMinValue) : null,
        stockMaxValue: data.stockMaxValue ? Number(data.stockMaxValue) : null,
        stockHide: data.stockHide === true,
        stockAutoDeactivate: data.stockAutoDeactivate === true,
        barcodePrefix: data.barcodePrefix || null,
        barcodeSuffix: data.barcodeSuffix || null,
        barcodeAutoGenerate: data.barcodeAutoGenerate === true,
        validationRules: data.validationRules || null,
      },
    });
    return res.status(201).json({ item });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// Şablon güncelle
router.put('/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: AuthedRequest, res: any) => {
  try {
    const data = req.body;
    const updateData: Record<string, unknown> = {};
    const fields = [
      'name', 'marketplaceId', 'productId', 'titleFormat', 'description', 'priceFormula',
      'commissionRate', 'vatRate', 'cargoSettings', 'imageSettings', 'variantSettings',
      'categoryId', 'brandId', 'active',
      'priceSource', 'vatMode', 'priceMultiplier', 'priceFixedAmount', 'priceRangeRules',
      'excludeRules', 'titleVariables', 'titleMaxLength', 'titleSeoMaxLength',
      'descriptionBlocks', 'descriptionMaxLength',
      'imageMinCount', 'imageMaxCount', 'imageOrder', 'imageWatermark', 'imageBackground',
      'imageMinSize', 'imageFormat',
      'stockMultiplier', 'stockMinValue', 'stockMaxValue', 'stockHide', 'stockAutoDeactivate',
      'barcodePrefix', 'barcodeSuffix', 'barcodeAutoGenerate',
      'validationRules',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) {
        const val = data[field];
        if (['commissionRate', 'vatRate', 'priceMultiplier', 'priceFixedAmount',
             'titleMaxLength', 'titleSeoMaxLength', 'descriptionMaxLength',
             'imageMinCount', 'imageMaxCount', 'imageMinSize',
             'stockMultiplier', 'stockMinValue', 'stockMaxValue'].includes(field)) {
          updateData[field] = val !== null ? Number(val) : null;
        } else {
          updateData[field] = val;
        }
      }
    }
    const item = await prisma.listingTemplate.update({
      where: { id: req.params.id },
      data: updateData,
    });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// Şablon sil
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthedRequest, res: any) => {
  try {
    await prisma.listingTemplate.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 2. ŞABLON KOPYALA ====================

router.post('/:id/duplicate', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: AuthedRequest, res: any) => {
  try {
    const source = await prisma.listingTemplate.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ ok: false, error: 'Kaynak şablon bulunamadı' });

    const { id, createdAt, updatedAt, ...data } = source as any;
    const item = await prisma.listingTemplate.create({
      data: {
        ...data,
        name: `${data.name} (Kopya)`,
        active: false,
      },
    });
    return res.status(201).json({ item });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 3. FİYAT ÖNİZLEME ====================

router.post('/:id/price-preview', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const template = await prisma.listingTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ ok: false, error: 'Şablon bulunamadı' });

    const { purchasePrice, salePrice, vatRate, commissionRate } = req.body;
    const result = calculatePrice(
      {
        purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : 100,
        salePrice: salePrice !== undefined ? Number(salePrice) : null,
        vatRate: vatRate !== undefined ? Number(vatRate) : null,
        commissionRate: commissionRate !== undefined ? Number(commissionRate) : null,
      },
      {
        priceSource: template.priceSource,
        vatMode: template.vatMode,
        priceMultiplier: template.priceMultiplier,
        priceFixedAmount: template.priceFixedAmount,
        priceRangeRules: template.priceRangeRules,
        vatRate: template.vatRate,
        commissionRate: template.commissionRate,
      }
    );
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 4. BAŞLIK ÖNİZLEME ====================

router.post('/:id/title-preview', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const template = await prisma.listingTemplate.findUnique({
      where: { id: req.params.id },
      select: { titleFormat: true, titleMaxLength: true },
    });
    if (!template) return res.status(404).json({ ok: false, error: 'Şablon bulunamadı' });

    const product = req.body;
    const title = renderTitle(product, template.titleFormat || '', template.titleMaxLength);
    return res.json({ title, length: title.length, maxLength: template.titleMaxLength });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 5. CANLI ÖNİZLEME (ÜRÜN + ŞABLON) ====================

router.post('/:id/preview/:productId', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const result = await generatePreview(req.params.productId, req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 6. FİYAT SİMÜLASYONU ====================

router.post('/:id/simulate', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: AuthedRequest, res: any) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'productIds dizisi gerekli' });
    }
    if (productIds.length > 10000) {
      return res.status(400).json({ ok: false, error: 'Maksimum 10.000 ürün' });
    }
    const results = await simulatePrices(productIds.slice(0, 10000), req.params.id);
    return res.json({ results, total: results.length });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 7. DOĞRULAMA ====================

router.post('/:id/validate/:productId', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const [product, template] = await Promise.all([
      prisma.product.findUnique({
        where: { id: req.params.productId },
        include: { variants: { select: { name: true, value: true } } },
      }),
      prisma.listingTemplate.findUnique({ where: { id: req.params.id } }),
    ]);

    if (!product) return res.status(404).json({ ok: false, error: 'Ürün bulunamadı' });
    if (!template) return res.status(404).json({ ok: false, error: 'Şablon bulunamadı' });

    const forbiddenWords = await getForbiddenWords(template.marketplaceId);

    const result = validateProduct(product, {
      titleFormat: template.titleFormat,
      titleMaxLength: template.titleMaxLength,
      imageMinCount: template.imageMinCount,
      imageMaxCount: template.imageMaxCount,
      imageMinSize: template.imageMinSize,
      validationRules: template.validationRules,
      commissionRate: template.commissionRate ?? undefined,
    }, forbiddenWords);

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 8. TOPLU DOĞRULAMA ====================

router.post('/:id/bulk-validate', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: AuthedRequest, res: any) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds)) {
      return res.status(400).json({ ok: false, error: 'productIds dizisi gerekli' });
    }

    const [template, forbiddenWords] = await Promise.all([
      prisma.listingTemplate.findUnique({ where: { id: req.params.id } }),
      getForbiddenWords(),
    ]);

    if (!template) return res.status(404).json({ ok: false, error: 'Şablon bulunamadı' });

    const products = await prisma.product.findMany({
      where: { id: { in: productIds.slice(0, 500) } },
      include: { variants: { select: { name: true, value: true } } },
    });

    const results = products.map(product => ({
      productId: product.id,
      productTitle: product.title || product.xmlKey,
      validation: validateProduct(product, {
        titleFormat: template.titleFormat,
        titleMaxLength: template.titleMaxLength,
        imageMinCount: template.imageMinCount,
        imageMaxCount: template.imageMaxCount,
        validationRules: template.validationRules,
        commissionRate: template.commissionRate ?? undefined,
      }, forbiddenWords),
    }));

    const passed = results.filter(r => r.validation.passed).length;
    const failed = results.filter(r => !r.validation.passed).length;

    return res.json({ results, total: results.length, passed, failed });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 9. STOK HESAPLA ====================

router.post('/:id/stock-calc', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const template = await prisma.listingTemplate.findUnique({
      where: { id: req.params.id },
      select: { stockMultiplier: true, stockMinValue: true, stockMaxValue: true, stockHide: true, stockAutoDeactivate: true },
    });
    if (!template) return res.status(404).json({ ok: false, error: 'Şablon bulunamadı' });

    const { currentStock } = req.body;
    const result = calculateStock(currentStock || 0, template);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 10. BARKOT ÜRET ====================

router.post('/:id/generate-barcode', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const template = await prisma.listingTemplate.findUnique({
      where: { id: req.params.id },
      select: { barcodePrefix: true, barcodeSuffix: true },
    });
    const barcode = generateBarcode(template?.barcodePrefix || undefined, template?.barcodeSuffix || undefined);
    return res.json({ barcode });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 11. ŞABLON İSTATİSTİKLERİ ====================

router.get('/stats/summary', requireAuth, async (_req: AuthedRequest, res: any) => {
  try {
    const [total, active, inactive, byMarketplace] = await Promise.all([
      prisma.listingTemplate.count(),
      prisma.listingTemplate.count({ where: { active: true } }),
      prisma.listingTemplate.count({ where: { active: false } }),
      prisma.listingTemplate.groupBy({
        by: ['marketplaceId'],
        _count: { id: true },
      }),
    ]);
    return res.json({ total, active, inactive, byMarketplace });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 12. ŞABLONA UYGUN ÜRÜNLER ====================

router.get('/:id/matching-products', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const template = await prisma.listingTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ ok: false, error: 'Şablon bulunamadı' });

    const where: Record<string, unknown> = { status: { not: 'ERROR' } };

    if (template.categoryId) where.categoryId = template.categoryId;
    if (template.brandId) where.brandId = template.brandId;

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        take: 50,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, title: true, xmlKey: true, sku: true, barcode: true,
          purchasePrice: true, salePrice: true, stock: true, status: true,
          categoryMatch: true, brandMatch: true, variantMatch: true,
        },
      }),
    ]);

    return res.json({ items, total });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 13. YASAKLI KELİMELER ====================

router.get('/forbidden-words/list', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const words = await prisma.forbiddenWord.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ items: words });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

router.post('/forbidden-words', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: AuthedRequest, res: any) => {
  try {
    const { word, marketplaces } = req.body;
    if (!word || !word.trim()) {
      return res.status(400).json({ ok: false, error: 'Kelime gerekli' });
    }
    const item = await prisma.forbiddenWord.create({
      data: {
        word: word.trim().toLowerCase(),
        marketplaces: marketplaces ? JSON.stringify(marketplaces) : null,
      },
    });
    return res.status(201).json({ item });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ ok: false, error: 'Bu kelime zaten var' });
    }
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

router.delete('/forbidden-words/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthedRequest, res: any) => {
  try {
    await prisma.forbiddenWord.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 14. PAZARYERİ BAŞLIK KONFİG ====================

router.get('/marketplace-configs', requireAuth, async (_req: AuthedRequest, res: any) => {
  try {
    const configs = await prisma.marketplaceTitleConfig.findMany({ orderBy: { name: 'asc' } });
    return res.json({ items: configs });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

router.put('/marketplace-configs/:key', requireAuth, requireRole(['ADMIN']), async (req: AuthedRequest, res: any) => {
  try {
    const { maxLength, seoMaxLength } = req.body;
    const item = await prisma.marketplaceTitleConfig.update({
      where: { key: req.params.key },
      data: {
        maxLength: maxLength !== undefined ? Number(maxLength) : undefined,
        seoMaxLength: seoMaxLength !== undefined ? Number(seoMaxLength) : undefined,
      },
    });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 15. AÇIKLAMA BLOKLARINI TEST ET ====================

router.post('/render-description', requireAuth, async (req: AuthedRequest, res: any) => {
  try {
    const { product, descriptionBlocks } = req.body;
    const html = renderDescription(product || {}, descriptionBlocks || null, '');
    return res.json({ html });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

// ==================== 16. ŞABLONU TÜM ÜRÜNLERE UYGULA ====================

router.post('/:id/apply-all', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: AuthedRequest, res: any) => {
  try {
    const template = await prisma.listingTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ ok: false, error: 'Şablon bulunamadı' });

    const rules: Array<{ minPrice: number; maxPrice: number; profitMargin: number; fixedAmount: number; rounding: string }> =
      template.priceRangeRules ? JSON.parse(template.priceRangeRules) : [];

    if (rules.length === 0) return res.status(400).json({ ok: false, error: 'Fiyat kuralı bulunamadı' });

    // Tüm ürünleri getir
    const products = await prisma.product.findMany({
      where: { status: { not: 'ERROR' }, purchasePrice: { not: null, gt: 0 } },
      select: { id: true, purchasePrice: true, salePrice: true },
    });

    let updatedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const updates = batch.map(p => {
        const purchasePrice = Number(p.purchasePrice) || 0;
        let salePrice = purchasePrice;

        // KDV'li alış fiyatına kuralları uygula
        const sortedRules = [...rules].sort((a, b) => a.minPrice - b.minPrice);
        for (const rule of sortedRules) {
          if (rule.maxPrice === 0) {
            salePrice = purchasePrice * (1 + rule.profitMargin / 100) + rule.fixedAmount;
            salePrice = applyRounding(salePrice, rule.rounding);
            break;
          }
          if (purchasePrice >= rule.minPrice && purchasePrice <= rule.maxPrice) {
            salePrice = purchasePrice * (1 + rule.profitMargin / 100) + rule.fixedAmount;
            salePrice = applyRounding(salePrice, rule.rounding);
            break;
          }
        }

        return prisma.product.update({
          where: { id: p.id },
          data: { salePrice: Math.round(salePrice * 100) / 100 },
        });
      });
      await Promise.all(updates);
      updatedCount += batch.length;
    }

    return res.json({ ok: true, updatedCount, message: `${updatedCount} ürüne şablon fiyatları uygulandı` });
  } catch (error) {
    console.error('[listings] POST apply-all error:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

function applyRounding(price: number, rounding: string): number {
  switch (rounding) {
    case '0.90': return Math.floor(price) + 0.90;
    case '9.90': return Math.floor(price / 10) * 10 + 9.90;
    case '49.90': return Math.floor(price / 50) * 50 + 49.90;
    case '99.90': return Math.floor(price / 100) * 100 + 99.90;
    case 'nearest': return Math.round(price);
    default: return price;
  }
}

// ==================== 17. ŞABLON DIŞA AKTAR / İÇE AKTAR ====================

router.get('/export/all', requireAuth, async (_req: AuthedRequest, res: any) => {
  try {
    const items = await prisma.listingTemplate.findMany({
      include: { marketplace: { select: { key: true, name: true } } },
    });
    const exportData = items.map(({ id, createdAt, updatedAt, marketplace, ...data }) => ({
      ...data,
      marketplaceKey: marketplace?.key || null,
      exportedAt: new Date().toISOString(),
    }));
    return res.json({ items: exportData });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

router.post('/import', requireAuth, requireRole(['ADMIN']), async (req: AuthedRequest, res: any) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: 'items dizisi gerekli' });
    }

    let created = 0;
    for (const item of items) {
      const { marketplaceKey, exportedAt, ...data } = item;
      await prisma.listingTemplate.create({ data: { ...data, marketplaceId: data.marketplaceId || null } });
      created++;
    }

    return res.json({ ok: true, created });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

export default router;
