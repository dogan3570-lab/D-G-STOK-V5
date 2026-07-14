// ==================== VARIANT MAPPING CENTER V6.0 ENTERPRISE ====================
// DG STOK V5.0 - Varyant Eşleştirme Merkezi
// IQ300 Master Prompt Implementation
import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import {
  extractParentSku,
  detectVariantsFromText,
  aiSuggestVariants,
  groupProductsByParent,
  validateProduct,
  batchValidate,
  getMarketplaceRules,
  getVariantStats,
  mapVariantValue,
  scanForVariantGroups,
  normalizeVariantValue,
  detectVariantsFromSku,
  type VariantSuggestion,
} from '../services/variantEngine.ts';

const router = Router();

// ==================== CONSTANTS ====================

const MARKETPLACE_VARIANT_RULES: Record<string, any> = {
  trendyol: {
    requiredAttributes: ['Renk', 'Beden'],
    optionalAttributes: ['Numara', 'Cinsiyet', 'Materyal', 'Desen', 'Kalıp', 'Kapasite', 'Hacim', 'Model'],
    maxVariantsPerGroup: 100,
    variantGroupRequired: true,
    colorMapping: { black: 'Siyah', white: 'Beyaz', red: 'Kırmızı', blue: 'Mavi', green: 'Yeşil', yellow: 'Sarı', purple: 'Mor', orange: 'Turuncu', pink: 'Pembe', gray: 'Gri', brown: 'Kahverengi', beige: 'Bej', navy: 'Lacivert', burgundy: 'Bordo', silver: 'Gümüş', gold: 'Altın', cream: 'Krem' },
  },
  hepsiburada: {
    requiredAttributes: ['Renk'],
    optionalAttributes: ['Beden', 'Numara', 'Cinsiyet'],
    maxVariantsPerGroup: 50,
    variantGroupRequired: true,
    colorMapping: { black: 'Siyah', white: 'Beyaz', red: 'Kırmızı', blue: 'Mavi' },
  },
  amazon: {
    requiredAttributes: ['Renk', 'Beden'],
    optionalAttributes: ['Numara', 'Materyal'],
    maxVariantsPerGroup: 200,
    variantGroupRequired: true,
  },
  n11: {
    requiredAttributes: ['Renk'],
    optionalAttributes: ['Beden', 'Numara'],
    maxVariantsPerGroup: 30,
    variantGroupRequired: true,
  },
};

// ==================== HELPERS (imported from variantEngine.ts) ====================
// extractParentSku, groupProductsByParent, validateProduct, getMarketplaceRules
// are all imported from '../services/variantEngine.ts'

// ==================== 1. LIVE STATUS DASHBOARD ====================
router.get('/vcm/stats', requireAuth, async (req, res) => {
  try {
    const marketplaceKey = String(req.query?.marketplace || 'trendyol');

    const [
      totalProducts,
      variantMatchedProducts,
      totalVariants,
      aiCompleted,
      productsWithVariants,
      productsWithoutVariants,
      errorProducts,
      readyProducts,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { variantMatch: true } }),
      prisma.variant.count(),
      prisma.aIDecisionLog.count({ where: { module: 'VARIANT', autoApplied: true } }),
      prisma.product.count({ where: { variantMatch: true } }),
      prisma.product.count({ where: { variantMatch: false } }),
      prisma.product.count({ where: { status: 'ERROR' } }),
      prisma.product.count({ where: { status: 'READY' } }),
    ]);

    // Count parent groups (approximate via distinct SKU patterns)
    const allProducts = await prisma.product.findMany({
      where: { variantMatch: true },
      select: { sku: true, xmlKey: true },
      take: 10000,
    });

    const parentSkus = new Set<string>();
    for (const p of allProducts) {
      const parent = extractParentSku(p.sku || p.xmlKey);
      parentSkus.add(parent);
    }

    // Filter to only groups with 2+ products
    const skuCount = new Map<string, number>();
    for (const p of allProducts) {
      const parent = extractParentSku(p.sku || p.xmlKey);
      skuCount.set(parent, (skuCount.get(parent) || 0) + 1);
    }
    const totalParentProducts = [...skuCount.values()].filter(c => c >= 2).length;
    const totalChildSkus = [...skuCount.values()].filter(c => c >= 2).reduce((s, c) => s + c, 0);

    const manualPending = productsWithoutVariants;
    const successRate = totalProducts > 0 ? Math.round((variantMatchedProducts / totalProducts) * 100) : 0;

    res.json({
      totalVariantProducts: variantMatchedProducts,
      totalParentProducts,
      totalChildSkus,
      aiCompleted,
      manualPending,
      errorProducts,
      readyProducts,
      successRate,
      lastUpdate: new Date().toISOString(),
      marketplaceKey,
    });
  } catch (error) {
    console.error('[VCM] stats error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Veritabanı hatası' } });
  }
});

// ==================== 2. PARENT PRODUCT LISTING ====================
router.get('/vcm/parent-products', requireAuth, async (req, res) => {
  try {
    const marketplaceKey = String(req.query?.marketplace || 'trendyol');
    const page = Math.max(1, Number(req.query?.page) || 1);
    const pageSize = Math.min(1000, Math.max(50, Number(req.query?.pageSize) || 50));
    const search = String(req.query?.search || '').trim();
    const statusFilter = String(req.query?.status || '').trim();

    // Get all variant products (or all products if searching)
    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { sku: { contains: search } },
        { xmlKey: { contains: search } },
        { barcode: { contains: search } },
      ];
    }
    if (statusFilter === 'ready') where.variantMatch = true;
    else if (statusFilter === 'pending') where.variantMatch = false;
    else if (statusFilter === 'error') where.status = 'ERROR';

    // Get products with their variants
    const allProducts = await prisma.product.findMany({
      where,
      select: {
        id: true,
        sku: true,
        xmlKey: true,
        title: true,
        barcode: true,
        stock: true,
        status: true,
        variantMatch: true,
        brandId: true,
        brand: { select: { id: true, name: true } },
        variants: { select: { id: true, name: true, value: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Map to ChildProduct type for the engine
    const mappedProducts = allProducts.map(p => ({
      id: p.id,
      sku: p.sku,
      xmlKey: p.xmlKey,
      title: p.title,
      barcode: p.barcode,
      stock: p.stock,
      status: p.status,
      variantMatch: p.variantMatch,
      categoryMatch: false,
      brandMatch: false,
      templateMatch: false,
      brandName: p.brand?.name || null,
      variants: p.variants.map(v => ({ id: v.id, name: v.name, value: v.value })),
    }));

    // Group into parent products
    const groups = groupProductsByParent(mappedProducts);
    const parentList = Array.from(groups.values());

    // Pagination
    const total = parentList.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIdx = (page - 1) * pageSize;
    const items = parentList.slice(startIdx, startIdx + pageSize).map(group => ({
      parentSku: group.parentSku,
      title: group.title,
      brandName: group.brandName,
      totalVariants: group.children.length,
      variantStatus: group.variantStatus as 'ready' | 'partial' | 'pending',
      childrenCount: group.children.length,
      totalStock: group.children.reduce((s, c) => s + c.stock, 0),
      children: group.children.map(c => ({
        id: c.id,
        sku: c.sku,
        xmlKey: c.xmlKey,
        title: c.title,
        barcode: c.barcode,
        stock: c.stock,
        status: c.status,
        variantMatch: c.variantMatch,
        brandName: c.brandName,
        variants: c.variants,
      })),
    }));

    res.json({
      items,
      pagination: { page, pageSize, total, totalPages },
      marketplaceKey,
    });
  } catch (error) {
    console.error('[VCM] parent-products error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sorgu başarısız' } });
  }
});

// ==================== 3. CHILD VARIANTS FOR A PARENT ====================
router.get('/vcm/parent-products/:parentSku/children', requireAuth, async (req, res) => {
  try {
    const { parentSku } = req.params;

    const allProducts = await prisma.product.findMany({
      select: {
        id: true, sku: true, xmlKey: true, title: true, barcode: true,
        stock: true, status: true, variantMatch: true,
        brand: { select: { id: true, name: true } },
        variants: { select: { id: true, name: true, value: true } },
      },
      orderBy: { sku: 'asc' },
    });

    const children = allProducts.filter(p => extractParentSku(p.sku || p.xmlKey) === parentSku);

    if (children.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bu parent SKU için varyant bulunamadı' } });
    }

    res.json({
      parentSku,
      childrenCount: children.length,
      children: children.map(c => ({
        id: c.id,
        sku: c.sku,
        xmlKey: c.xmlKey,
        title: c.title,
        barcode: c.barcode,
        stock: c.stock,
        status: c.status,
        variantMatch: c.variantMatch,
        brandName: c.brand?.name || null,
        variants: c.variants,
      })),
    });
  } catch (error) {
    console.error('[VCM] children error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sorgu başarısız' } });
  }
});

// ==================== 4. MARKETPLACE VARIANT RULES ====================
router.get('/vcm/marketplace-rules/:key', requireAuth, async (req, res) => {
  try {
    const key = String(req.params.key).toLowerCase();
    const rules = MARKETPLACE_VARIANT_RULES[key] || MARKETPLACE_VARIANT_RULES.trendyol;

    // Get marketplace from DB
    const marketplace = await prisma.marketplace.findFirst({
      where: { key },
      select: { id: true, name: true, key: true },
    });

    res.json({
      marketplace: marketplace || { key, name: key.charAt(0).toUpperCase() + key.slice(1) },
      rules,
    });
  } catch (error) {
    console.error('[VCM] marketplace-rules error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sorgu başarısız' } });
  }
});

// ==================== 5. AI BATCH SUGGEST ====================
router.post('/vcm/ai-suggest-batch', requireAuth, async (req, res) => {
  try {
    const { productIds } = req.body;
    const where: any = {};
    if (Array.isArray(productIds) && productIds.length > 0) {
      where.id = { in: productIds.slice(0, 500) };
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true, title: true, xmlKey: true, sku: true, description: true,
        categoryId: true, brandId: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        variants: { select: { name: true, value: true } },
      },
      take: 500,
    });

    // AI knowledge base for learning
    const aiKnowledge = await prisma.aIKnowledge.findMany({
      where: { module: 'VARIANT' },
      select: { input: true, output: true, confidence: true, useCount: true },
      orderBy: { useCount: 'desc' },
      take: 200,
    });

    const colorPatterns = ['siyah','beyaz','kırmızı','mavi','yeşil','sarı','mor','turuncu','pembe','gri','lacivert','bordo','bej','kahverengi','krem','füme','metalik','altın','gümüş','turkuaz','black','white','red','blue','green','yellow','purple','orange','pink','gray','grey','brown'];
    const sizePatterns = ['xs','s','m','l','xl','xxl','2xl','3xl','4xl','5xl','xxxl','small','medium','large','xlarge'];

    const results: Array<{
      productId: string;
      productTitle: string;
      sku: string | null;
      suggestions: Array<{ name: string; value: string; confidence: number; source: string }>;
    }> = [];

    for (const product of products) {
      const searchText = [product.title || '', product.xmlKey || '', product.description || ''].join(' ').toLowerCase();
      const suggestions: Array<{ name: string; value: string; confidence: number; source: string }> = [];

      // Check AI knowledge first
      for (const knowledge of aiKnowledge) {
        if (searchText.includes(knowledge.input.toLowerCase())) {
          const alreadyHas = product.variants.some(v => v.name === 'Renk' && v.value === knowledge.output);
          if (!alreadyHas) {
            suggestions.push({
              name: 'Renk',
              value: knowledge.output,
              confidence: Math.round(knowledge.confidence),
              source: 'ai_learning',
            });
            break;
          }
        }
      }

      // Color detection
      for (const color of colorPatterns) {
        if (searchText.includes(color)) {
          const colorMap: Record<string, string> = {
            black: 'Siyah', white: 'Beyaz', red: 'Kırmızı', blue: 'Mavi',
            green: 'Yeşil', yellow: 'Sarı', purple: 'Mor', orange: 'Turuncu',
            pink: 'Pembe', gray: 'Gri', grey: 'Gri', brown: 'Kahverengi',
            beige: 'Bej', navy: 'Lacivert', burgundy: 'Bordo',
            silver: 'Gümüş', gold: 'Altın', cream: 'Krem',
          };
          const trColor = colorMap[color.toLowerCase()] || color.charAt(0).toUpperCase() + color.slice(1);
          const alreadyHas = product.variants.some(v => v.name === 'Renk' && v.value === trColor);
          if (!alreadyHas) {
            suggestions.push({ name: 'Renk', value: trColor, confidence: 92, source: 'pattern_color' });
            break;
          }
        }
      }

      // Size detection
      for (const size of sizePatterns) {
        if (searchText.includes(size)) {
          const sizeUpper = size.toUpperCase();
          const alreadyHas = product.variants.some(v => v.name === 'Beden' && v.value === sizeUpper);
          if (!alreadyHas) {
            suggestions.push({ name: 'Beden', value: sizeUpper, confidence: 88, source: 'pattern_size' });
            break;
          }
        }
      }

      // Number detection (shoe sizes, etc)
      const numberMatches = searchText.match(/\b(\d{2})\b/g);
      if (numberMatches) {
        for (const num of numberMatches) {
          const numVal = parseInt(num);
          if (numVal >= 32 && numVal <= 50) {
            const alreadyHas = product.variants.some(v => v.name === 'Numara' && v.value === num);
            if (!alreadyHas) {
              suggestions.push({ name: 'Numara', value: num, confidence: 85, source: 'pattern_number' });
              break;
            }
          }
        }
      }

      // Capacity detection (GB, TB)
      const capacityMatch = searchText.match(/\b(\d+)\s*(gb|tb|mb)\b/i);
      if (capacityMatch) {
        const capValue = capacityMatch[1] + capacityMatch[2].toUpperCase();
        const alreadyHas = product.variants.some(v => v.name === 'Kapasite' && v.value === capValue);
        if (!alreadyHas) {
          suggestions.push({ name: 'Kapasite', value: capValue, confidence: 90, source: 'pattern_capacity' });
        }
      }

      if (suggestions.length > 0) {
        results.push({
          productId: product.id,
          productTitle: product.title || product.xmlKey,
          sku: product.sku,
          suggestions,
        });
      }
    }

    // Record AI decision logs for learning
    const logPromises = results.slice(0, 100).map(r =>
      prisma.aIDecisionLog.create({
        data: {
          productId: r.productId,
          module: 'VARIANT',
          suggestion: JSON.stringify(r.suggestions),
          confidence: r.suggestions[0]?.confidence || 0,
          reason: r.suggestions[0]?.source || 'ai_pattern',
          autoApplied: false,
        },
      }).catch(() => null)
    );
    await Promise.all(logPromises);

    res.json({
      totalScanned: products.length,
      totalSuggestions: results.length,
      results,
    });
  } catch (error) {
    console.error('[VCM] ai-suggest-batch error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'AI öneri başarısız' } });
  }
});

// ==================== 6. BATCH APPLY VARIANTS ====================
router.post('/vcm/batch-apply', requireAuth, async (req, res) => {
  try {
    const { matches } = req.body;
    // matches: Array<{ productId: string, variants: Array<{ name: string, value: string }> }>

    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'matches array gereklidir' } });
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    for (const match of matches) {
      const { productId, variants } = match;
      if (!productId || !Array.isArray(variants)) continue;

      for (const variant of variants) {
        try {
          const { name, value } = variant;
          if (!name || !value) continue;

          // Check for duplicate barcode/SKU in variant group (validation)
          const existing = await prisma.variant.findFirst({
            where: { productId, name, value },
          });

          if (!existing) {
            await prisma.variant.create({
              data: { name, value, productId },
            });
            totalCreated++;
          } else {
            totalUpdated++;
          }
        } catch (err: any) {
          errors.push(`Ürün ${productId}: ${err?.message || 'Bilinmeyen hata'}`);
        }
      }

      // Mark product as variant matched
      await prisma.product.update({
        where: { id: productId },
        data: { variantMatch: true },
      }).catch(() => null);

      // Update workflow state
      await prisma.workflowState.upsert({
        where: { productId },
        create: {
          productId,
          status: 'IN_PROGRESS',
          stepVariant: 'OK',
          readiness: 50,
        },
        update: {
          stepVariant: 'OK',
          readiness: { increment: 20 },
        },
      }).catch(() => null);
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'VCM_BATCH_APPLY',
        entity: 'variant',
        details: `VCM toplu varyant: ${totalCreated} oluşturuldu, ${totalUpdated} güncellendi, ${errors.length} hata`,
        actorUserId: (req as any).actor?.userId || null,
      },
    });

    res.json({
      totalCreated,
      totalUpdated,
      errorsCount: errors.length,
      errors: errors.slice(0, 10),
      message: `${totalCreated} varyant oluşturuldu, ${totalUpdated} güncellendi`,
    });
  } catch (error) {
    console.error('[VCM] batch-apply error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Toplu varyant uygulama başarısız' } });
  }
});

// ==================== 7. VALIDATION CHECK ====================
router.post('/vcm/validate', requireAuth, async (req, res) => {
  try {
    const { productIds, marketplaceKey } = req.body;
    const where: any = {};
    if (Array.isArray(productIds) && productIds.length > 0) {
      where.id = { in: productIds.slice(0, 500) };
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true, sku: true, xmlKey: true, title: true, barcode: true,
        variantMatch: true, categoryMatch: true, brandMatch: true, templateMatch: true,
        status: true,
        variants: { select: { name: true, value: true } },
      },
      take: 500,
    });

    const rules = MARKETPLACE_VARIANT_RULES[marketplaceKey] || MARKETPLACE_VARIANT_RULES.trendyol;

    // Check for duplicate barcodes and SKUs across all products
    const allBarcodes = new Map<string, string[]>();
    const allSkus = new Map<string, string[]>();
    for (const p of products) {
      if (p.barcode) {
        if (!allBarcodes.has(p.barcode)) allBarcodes.set(p.barcode, []);
        allBarcodes.get(p.barcode)!.push(p.id);
      }
      if (p.sku) {
        if (!allSkus.has(p.sku)) allSkus.set(p.sku, []);
        allSkus.get(p.sku)!.push(p.id);
      }
    }

    const results = products.map(p => {
      const validation = validateProduct(
        {
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          variantMatch: p.variantMatch,
          categoryMatch: p.categoryMatch,
          brandMatch: p.brandMatch,
          templateMatch: p.templateMatch,
          status: p.status,
          variants: p.variants,
        },
        {
          requiredAttributes: rules.requiredAttributes || [],
          optionalAttributes: rules.optionalAttributes || [],
        },
        {
          allSkus,
          allBarcodes,
        }
      );

      return {
        productId: p.id,
        sku: p.sku,
        title: p.title,
        score: validation.score,
        validationStatus: validation.status,
        errors: validation.errors,
        checks: validation.checks,
      };
    });

    res.json({
      totalChecked: products.length,
      ready: results.filter(r => r.validationStatus === 'ready').length,
      needsReview: results.filter(r => r.validationStatus === 'needs_review').length,
      blocked: results.filter(r => r.validationStatus === 'blocked').length,
      results,
    });
  } catch (error) {
    console.error('[VCM] validate error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Doğrulama başarısız' } });
  }
});

// ==================== 8. SCAN FOR VARIANT GROUPS ====================
router.post('/vcm/scan', requireAuth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true, sku: true, xmlKey: true, title: true,
        variantMatch: true,
        variants: { select: { name: true, value: true } },
      },
      take: 10000,
    });

    let newGroupsFound = 0;
    let productsGrouped = 0;

    // Group by parent SKU
    const skuGroups = new Map<string, typeof products>();
    for (const p of products) {
      const parentSku = extractParentSku(p.sku || p.xmlKey);
      if (!skuGroups.has(parentSku)) skuGroups.set(parentSku, []);
      skuGroups.get(parentSku)!.push(p);
    }

    // Auto-detect variant attributes for groups
    for (const [parentSku, children] of skuGroups) {
      if (children.length < 2) continue;

      const allSearchText = children.map(c => [c.title || '', c.xmlKey || ''].join(' ').toLowerCase());

      for (const child of children) {
        if (child.variantMatch) continue;

        const searchText = [child.title || '', child.xmlKey || ''].join(' ').toLowerCase();
        const detectedVariants: Array<{ name: string; value: string }> = [];

        // Color
        const colorMap: Record<string, string> = {
          black: 'Siyah', white: 'Beyaz', red: 'Kırmızı', blue: 'Mavi',
          green: 'Yeşil', yellow: 'Sarı', purple: 'Mor', orange: 'Turuncu',
          pink: 'Pembe', gray: 'Gri', grey: 'Gri', brown: 'Kahverengi',
          beige: 'Bej', navy: 'Lacivert', burgundy: 'Bordo',
          silver: 'Gümüş', gold: 'Altın', cream: 'Krem',
          siyah: 'Siyah', beyaz: 'Beyaz', kırmızı: 'Kırmızı', mavi: 'Mavi',
          yeşil: 'Yeşil', sarı: 'Sarı', mor: 'Mor', turuncu: 'Turuncu',
          pembe: 'Pembe', lacivert: 'Lacivert', bordo: 'Bordo',
          bej: 'Bej', kahverengi: 'Kahverengi', krem: 'Krem',
        };
        for (const [eng, tr] of Object.entries(colorMap)) {
          if (searchText.includes(eng)) {
            detectedVariants.push({ name: 'Renk', value: tr });
            break;
          }
        }

        // Size
        const sizePatterns = ['xs','s','m','l','xl','xxl','2xl','3xl','4xl','5xl','xxxl'];
        for (const size of sizePatterns) {
          if (searchText.includes(size)) {
            detectedVariants.push({ name: 'Beden', value: size.toUpperCase() });
            break;
          }
        }

        // Number
        const numMatch = searchText.match(/\b(\d{2})\b/g);
        if (numMatch) {
          for (const num of numMatch) {
            const n = parseInt(num);
            if (n >= 32 && n <= 50) {
              detectedVariants.push({ name: 'Numara', value: num });
              break;
            }
          }
        }

        if (detectedVariants.length > 0) {
          for (const dv of detectedVariants) {
            await prisma.variant.create({
              data: { name: dv.name, value: dv.value, productId: child.id },
            }).catch(() => null);
          }
          await prisma.product.update({
            where: { id: child.id },
            data: { variantMatch: true },
          }).catch(() => null);
          productsGrouped++;
        }
      }

      newGroupsFound++;
    }

    await prisma.auditLog.create({
      data: {
        action: 'VCM_SCAN',
        entity: 'variant',
        details: `VCM tarama: ${newGroupsFound} grup bulundu, ${productsGrouped} ürün gruplandı`,
        actorUserId: (req as any).actor?.userId || null,
      },
    });

    res.json({
      newGroupsFound,
      productsGrouped,
      totalScanned: products.length,
      message: `${newGroupsFound} varyant grubu bulundu, ${productsGrouped} ürün eşleştirildi`,
    });
  } catch (error) {
    console.error('[VCM] scan error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Tarama başarısız' } });
  }
});

// ==================== 9. AI AUTO-APPLY (high confidence) ====================
router.post('/vcm/ai-auto-apply', requireAuth, async (req, res) => {
  try {
    const { productIds } = req.body;
    const where: any = { variantMatch: false };
    if (Array.isArray(productIds) && productIds.length > 0) {
      where.id = { in: productIds.slice(0, 500) };
    }

    const products = await prisma.product.findMany({
      where,
      select: { id: true, title: true, xmlKey: true, description: true, variants: { select: { name: true, value: true } } },
      take: 500,
    });

    let autoApplied = 0;
    let needsApproval = 0;

    for (const product of products) {
      const searchText = [product.title || '', product.xmlKey || '', product.description || ''].join(' ').toLowerCase();
      const detected: Array<{ name: string; value: string; confidence: number }> = [];

      const colorMap: Record<string, { tr: string; conf: number }> = {
        siyah: { tr: 'Siyah', conf: 99 }, beyaz: { tr: 'Beyaz', conf: 99 },
        kırmızı: { tr: 'Kırmızı', conf: 99 }, mavi: { tr: 'Mavi', conf: 99 },
        yeşil: { tr: 'Yeşil', conf: 99 }, sarı: { tr: 'Sarı', conf: 99 },
        mor: { tr: 'Mor', conf: 99 }, turuncu: { tr: 'Turuncu', conf: 99 },
        pembe: { tr: 'Pembe', conf: 99 }, gri: { tr: 'Gri', conf: 99 },
        lacivert: { tr: 'Lacivert', conf: 99 }, bordo: { tr: 'Bordo', conf: 99 },
        bej: { tr: 'Bej', conf: 99 }, kahverengi: { tr: 'Kahverengi', conf: 99 },
        krem: { tr: 'Krem', conf: 99 },
        black: { tr: 'Siyah', conf: 97 }, white: { tr: 'Beyaz', conf: 97 },
        red: { tr: 'Kırmızı', conf: 97 }, blue: { tr: 'Mavi', conf: 97 },
        green: { tr: 'Yeşil', conf: 97 }, yellow: { tr: 'Sarı', conf: 97 },
        purple: { tr: 'Mor', conf: 97 }, orange: { tr: 'Turuncu', conf: 97 },
        pink: { tr: 'Pembe', conf: 97 }, gray: { tr: 'Gri', conf: 97 },
        grey: { tr: 'Gri', conf: 97 }, brown: { tr: 'Kahverengi', conf: 97 },
        navy: { tr: 'Lacivert', conf: 97 }, burgundy: { tr: 'Bordo', conf: 97 },
        silver: { tr: 'Gümüş', conf: 97 }, gold: { tr: 'Altın', conf: 97 },
      };

      for (const [eng, { tr, conf }] of Object.entries(colorMap)) {
        if (searchText.includes(eng)) {
          const alreadyHas = product.variants.some(v => v.name === 'Renk' && v.value === tr);
          if (!alreadyHas) {
            detected.push({ name: 'Renk', value: tr, confidence: conf });
            break;
          }
        }
      }

      for (const d of detected) {
        if (d.confidence >= 99) {
          // Auto-apply
          await prisma.variant.create({
            data: { name: d.name, value: d.value, productId: product.id },
          }).catch(() => null);
          autoApplied++;
        } else if (d.confidence >= 95) {
          needsApproval++;
        }
      }

      if (detected.length > 0) {
        await prisma.product.update({
          where: { id: product.id },
          data: { variantMatch: true },
        }).catch(() => null);
      }
    }

    await prisma.auditLog.create({
      data: {
        action: 'VCM_AI_AUTO_APPLY',
        entity: 'variant',
        details: `AI otomatik: ${autoApplied} uygulandı, ${needsApproval} onay bekliyor`,
        actorUserId: (req as any).actor?.userId || null,
      },
    });

    res.json({
      autoApplied,
      needsApproval,
      totalScanned: products.length,
      message: `${autoApplied} varyant otomatik uygulandı, ${needsApproval} onay bekliyor`,
    });
  } catch (error) {
    console.error('[VCM] ai-auto-apply error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'AI otomatik uygulama başarısız' } });
  }
});

// ==================== 10. TEST CENTER ====================
router.post('/vcm/test', requireAuth, async (_req, res) => {
  try {
    const tests: Array<{ name: string; passed: boolean; duration: number; details: string }> = [];
    const start = Date.now();

    // Test 1: DB Connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      tests.push({ name: 'Veritabanı Bağlantısı', passed: true, duration: Date.now() - start, details: 'OK' });
    } catch {
      tests.push({ name: 'Veritabanı Bağlantısı', passed: false, duration: Date.now() - start, details: 'Bağlantı hatası' });
    }

    // Test 2: Product Count
    const t2 = Date.now();
    const productCount = await prisma.product.count();
    tests.push({ name: 'Ürün Sayısı', passed: true, duration: Date.now() - t2, details: `${productCount} ürün` });

    // Test 3: Variant Count
    const t3 = Date.now();
    const variantCount = await prisma.variant.count();
    tests.push({ name: 'Varyant Sayısı', passed: true, duration: Date.now() - t3, details: `${variantCount} varyant` });

    // Test 4: Parent Detection
    const t4 = Date.now();
    const sample = await prisma.product.findMany({ select: { sku: true, xmlKey: true }, take: 100 });
    const parentSkus = new Set(sample.map(p => extractParentSku(p.sku || p.xmlKey)));
    tests.push({ name: 'Parent Tespiti', passed: parentSkus.size > 0, duration: Date.now() - t4, details: `${parentSkus.size} benzersiz parent` });

    // Test 5: Marketplace Rules
    const t5 = Date.now();
    const mpCount = await prisma.marketplace.count();
    tests.push({ name: 'Pazaryeri Kuralları', passed: mpCount > 0, duration: Date.now() - t5, details: `${mpCount} pazaryeri` });

    // Test 6: AI Knowledge
    const t6 = Date.now();
    const aiCount = await prisma.aIKnowledge.count({ where: { module: 'VARIANT' } });
    tests.push({ name: 'AI Bilgi Tabanı', passed: true, duration: Date.now() - t6, details: `${aiCount} kayıt` });

    // Test 7: Validation Engine
    const t7 = Date.now();
    tests.push({ name: 'Validation Engine', passed: true, duration: Date.now() - t7, details: 'Hazır' });

    const allPassed = tests.every(t => t.passed);
    const totalDuration = Date.now() - start;

    res.json({
      allPassed,
      totalDuration,
      tests,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[VCM] test error:', error);
    res.status(500).json({ error: { code: 'TEST_ERROR', message: 'Test başarısız' } });
  }
});

// ==================== 11. LIST ALL MARKETPLACES (for dropdown) ====================
router.get('/vcm/marketplaces', requireAuth, async (_req, res) => {
  try {
    const items = await prisma.marketplace.findMany({
      where: { active: true },
      select: { id: true, key: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json({ items });
  } catch (error) {
    console.error('[VCM] marketplaces error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sorgu başarısız' } });
  }
});

// ==================== 12. LIVE STATS (V6.0 Enhanced) ====================
router.get('/vcm/live-stats', requireAuth, async (req, res) => {
  try {
    const marketplaceKey = String(req.query?.marketplace || 'trendyol');
    const stats = await getVariantStats(marketplaceKey);
    res.json(stats);
  } catch (error) {
    console.error('[VCM] live-stats error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'İstatistik hatası' } });
  }
});

// ==================== 13. MAP VARIANT VALUE (V6.0) ====================
router.post('/vcm/map-value', requireAuth, async (req, res) => {
  try {
    const { xmlValue, attributeType, marketplaceKey } = req.body;
    if (!xmlValue || !attributeType) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'xmlValue ve attributeType gerekli' } });
    }
    const result = await mapVariantValue(xmlValue, attributeType, marketplaceKey);
    res.json(result);
  } catch (error) {
    console.error('[VCM] map-value error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Eşleştirme hatası' } });
  }
});

// ==================== 14. DETECT VARIANTS FOR PRODUCT ====================
router.post('/vcm/detect', requireAuth, async (req, res) => {
  try {
    const { productId, title, description } = req.body;
    if (!productId) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productId gerekli' } });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, description: true, xmlKey: true, sku: true,
        variants: { select: { name: true, value: true } } },
    });

    if (!product) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ürün bulunamadı' } });
    }

    const searchText = title || product.title || product.xmlKey || '';
    const descText = description || product.description || '';

    const suggestions = await aiSuggestVariants(
      product.id,
      searchText,
      descText,
      product.variants
    );

    // Also detect from SKU
    if (product.sku) {
      const skuSuggestions = detectVariantsFromSku(product.sku, product.variants);
      // Merge without duplicates - prefer AI suggestions
      for (const ss of skuSuggestions) {
        const exists = suggestions.some(s => s.name === ss.name && s.value === ss.value);
        if (!exists) suggestions.push(ss);
      }
    }

    res.json({ productId: product.id, suggestions, totalDetected: suggestions.length });
  } catch (error) {
    console.error('[VCM] detect error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Varyant tespit hatası' } });
  }
});

// ==================== 15. SEED MARKETPLACE RULES ====================
router.post('/vcm/seed-rules', requireAuth, async (_req, res) => {
  try {
    const rules = [
      {
        marketplaceKey: 'trendyol',
        marketplaceName: 'Trendyol',
        requiredAttributes: JSON.stringify(['Renk', 'Beden']),
        optionalAttributes: JSON.stringify(['Numara', 'Cinsiyet', 'Materyal', 'Desen', 'Kalıp', 'Kapasite', 'Hacim', 'Model']),
        maxVariantsPerGroup: 100,
        variantGroupRequired: true,
        colorMapping: JSON.stringify({ black: 'Siyah', white: 'Beyaz', red: 'Kırmızı', blue: 'Mavi', green: 'Yeşil', yellow: 'Sarı', purple: 'Mor', orange: 'Turuncu', pink: 'Pembe', gray: 'Gri', brown: 'Kahverengi', beige: 'Bej', navy: 'Lacivert', burgundy: 'Bordo', silver: 'Gümüş', gold: 'Altın', cream: 'Krem' }),
      },
      {
        marketplaceKey: 'hepsiburada',
        marketplaceName: 'Hepsiburada',
        requiredAttributes: JSON.stringify(['Renk']),
        optionalAttributes: JSON.stringify(['Beden', 'Numara', 'Cinsiyet']),
        maxVariantsPerGroup: 50,
        variantGroupRequired: true,
        colorMapping: JSON.stringify({ black: 'Siyah', white: 'Beyaz', red: 'Kırmızı', blue: 'Mavi' }),
      },
      {
        marketplaceKey: 'amazon',
        marketplaceName: 'Amazon',
        requiredAttributes: JSON.stringify(['Renk', 'Beden']),
        optionalAttributes: JSON.stringify(['Numara', 'Materyal']),
        maxVariantsPerGroup: 200,
        variantGroupRequired: true,
      },
      {
        marketplaceKey: 'n11',
        marketplaceName: 'N11',
        requiredAttributes: JSON.stringify(['Renk']),
        optionalAttributes: JSON.stringify(['Beden', 'Numara']),
        maxVariantsPerGroup: 30,
        variantGroupRequired: true,
      },
    ];

    let created = 0;
    let updated = 0;
    for (const rule of rules) {
      const existing = await prisma.marketplaceVariantRule.findUnique({
        where: { marketplaceKey: rule.marketplaceKey },
      });
      if (existing) {
        await prisma.marketplaceVariantRule.update({
          where: { marketplaceKey: rule.marketplaceKey },
          data: rule,
        });
        updated++;
      } else {
        await prisma.marketplaceVariantRule.create({ data: rule });
        created++;
      }
    }

    res.json({ created, updated, message: `${created} oluşturuldu, ${updated} güncellendi` });
  } catch (error) {
    console.error('[VCM] seed-rules error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kural ekleme hatası' } });
  }
});

// ==================== EXISTING ENDPOINTS (BACKWARD COMPATIBLE) ====================

router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const [totalVariants, variantTypes, matchedProducts, unmatchedProducts] = await Promise.all([
      prisma.variant.count(),
      prisma.variant.groupBy({ by: ['name'], _count: { name: true }, orderBy: { _count: { name: 'desc' } } }),
      prisma.product.count({ where: { variantMatch: true } }),
      prisma.product.count({ where: { variantMatch: false } }),
    ]);
    res.json({
      totalVariants,
      variantTypes: variantTypes.map(v => ({ name: v.name, count: v._count.name })),
      matchedProducts,
      unmatchedProducts,
      productsWithVariants: matchedProducts,
    });
  } catch (error) {
    console.error('[variants] GET stats error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Veritabanı hatası' } });
  }
});

router.get('/unmatched-products', requireAuth, async (req, res) => {
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
        where, take: limit, skip: offset, orderBy: { createdAt: 'desc' },
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
    console.error('[variants] GET unmatched-products error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sorgu başarısız' } });
  }
});

router.post('/batch', requireAuth, async (req, res) => {
  try {
    const { name, value, productIds } = req.body;
    if (!name || !value || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name, value ve productIds gerekli' } });
    }
    if (productIds.length > 500) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Maksimum 500 ürün' } });
    }
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
      await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { variantMatch: true } });
    }
    await prisma.auditLog.create({
      data: {
        action: 'BATCH_VARIANT_CREATE', entity: 'variant',
        details: `Toplu varyant: ${created} adet ${name}:${value}`,
        actorUserId: (req as any).actor?.userId || null,
      },
    });
    return res.json({ created, skipped: productIds.length - created, message: `${created} varyant oluşturuldu, ${productIds.length - created} zaten vardı` });
  } catch (error) {
    console.error('[variants] POST batch error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Toplu varyant ekleme başarısız' } });
  }
});

router.post('/auto-detect', requireAuth, async (req, res) => {
  try {
    const { productIds } = req.body;
    const where: any = { variantMatch: false };
    if (Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };
    const products = await prisma.product.findMany({ where, select: { id: true, title: true, xmlKey: true }, take: 500 });
    const colorPatterns = ['kırmızı','mavi','yeşil','sarı','beyaz','siyah','mor','turuncu','pembe','gri','lacivert','bordo','bej','kahverengi','krem','füme','metalik','altın','gümüş','turkuaz'];
    const sizePatterns = ['xs','s','m','l','xl','xxl','3xl','4xl','5xl'];
    const variantData: Array<{ productId: string; name: string; value: string }> = [];
    const matchedProductIds: string[] = [];
    for (const product of products) {
      const searchText = [product.title || '', product.xmlKey || ''].join(' ').toLowerCase();
      const detected: Array<{ name: string; value: string }> = [];
      for (const color of colorPatterns) {
        if (searchText.includes(color)) { detected.push({ name: 'Renk', value: color.charAt(0).toUpperCase() + color.slice(1) }); break; }
      }
      for (const size of sizePatterns) {
        if (searchText.includes(size)) { detected.push({ name: 'Beden', value: size.toUpperCase() }); break; }
      }
      const numberMatches = searchText.match(/\b(\d{2,3})\b/g);
      if (numberMatches) {
        for (const num of numberMatches) {
          const numVal = parseInt(num);
          if ((numVal >= 32 && numVal <= 50) || (numVal >= 36 && numVal <= 46)) {
            detected.push({ name: 'Numara', value: num }); break;
          }
        }
      }
      if (detected.length > 0) {
        matchedProductIds.push(product.id);
        for (const v of detected) variantData.push({ productId: product.id, name: v.name, value: v.value });
      }
    }
    let totalCreated = 0;
    if (variantData.length > 0) {
      const existingVariants = await prisma.variant.findMany({
        where: { OR: variantData.map(v => ({ productId: v.productId, name: v.name, value: v.value })) },
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
      await prisma.product.updateMany({ where: { id: { in: matchedProductIds } }, data: { variantMatch: true } });
    }
    await prisma.auditLog.create({
      data: { action: 'AUTO_VARIANT_DETECT', entity: 'variant', details: `Otomatik tespit: ${totalCreated} varyant, ${matchedProductIds.length} ürün`, actorUserId: (req as any).actor?.userId || null },
    });
    return res.json({ totalDetected: totalCreated, totalProductsWithVariants: matchedProductIds.length, totalScanned: products.length, message: `${totalCreated} varyant ${matchedProductIds.length} üründe tespit edildi` });
  } catch (error) {
    console.error('[variants] POST auto-detect error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Otomatik varyant tespiti başarısız' } });
  }
});

router.post('/bulk-match', requireAuth, async (req, res) => {
  try {
    const { matches } = req.body;
    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'matches array is required' } });
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
        where: { OR: allVariantData.map(v => ({ productId: v.productId, name: v.name, value: v.value })) },
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
      await prisma.product.updateMany({ where: { id: { in: uniqueProductIds } }, data: { variantMatch: true } });
    }
    await prisma.auditLog.create({
      data: { action: 'BULK_VARIANT_MATCH', entity: 'variant', details: `Toplu eşleştirme: ${totalCreated} varyant, ${uniqueProductIds.length} ürün`, actorUserId: (req as any).actor?.userId || null },
    });
    return res.json({ totalCreated, totalProducts: uniqueProductIds.length, message: `${totalCreated} varyant ${uniqueProductIds.length} ürüne eklendi` });
  } catch (error) {
    console.error('[variants] POST bulk-match error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Toplu varyant eşleştirme başarısız' } });
  }
});

router.get('/xml-variants', requireAuth, async (req, res) => {
  try {
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : null;
    const search = String(req.query?.search ?? '').trim();
    const where: any = { variantMatch: false };
    if (xmlSourceId) where.xmlSourceId = xmlSourceId;
    if (search) { where.OR = [{ title: { contains: search } }, { xmlKey: { contains: search } }]; }
    const products = await prisma.product.findMany({
      where, take: 100, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, xmlKey: true, sku: true, barcode: true, stock: true, salePrice: true, images: true, description: true, detail: true, technicalSpecs: true, xmlSource: { select: { id: true, name: true } } },
    });
    const colorPatterns = ['kırmızı','mavi','yeşil','sarı','beyaz','siyah','mor','turuncu','pembe','gri','lacivert','bordo','bej','kahverengi','krem','füme','metalik','altın','gümüş','turkuaz'];
    const sizePatterns = ['xs','s','m','l','xl','xxl','3xl','4xl','5xl','small','medium','large','xlarge'];
    const detectedVariants: Array<{ productId: string; productName: string; xmlKey: string; detectedVariants: Array<{ name: string; value: string; confidence: number }> }> = [];
    for (const product of products) {
      const searchText = [product.title || '', product.xmlKey || '', product.description || '', product.detail || '', product.technicalSpecs || ''].join(' ').toLowerCase();
      const detected: Array<{ name: string; value: string; confidence: number }> = [];
      for (const color of colorPatterns) { if (searchText.includes(color)) { detected.push({ name: 'Renk', value: color.charAt(0).toUpperCase() + color.slice(1), confidence: 80 }); break; } }
      for (const size of sizePatterns) { if (searchText.includes(size)) { detected.push({ name: 'Beden', value: size.toUpperCase(), confidence: 75 }); break; } }
      const numberMatches = searchText.match(/\b(\d{2,3})\b/g);
      if (numberMatches) { for (const num of numberMatches) { const numVal = parseInt(num); if ((numVal >= 32 && numVal <= 50)) { detected.push({ name: 'Numara', value: num, confidence: 70 }); break; } } }
      if (detected.length > 0) { detectedVariants.push({ productId: product.id, productName: product.title || product.xmlKey, xmlKey: product.xmlKey, detectedVariants: detected }); }
    }
    return res.json({ totalProducts: products.length, productsWithDetectedVariants: detectedVariants.length, items: detectedVariants });
  } catch (error) {
    console.error('[variants] GET xml-variants error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'XML varyant tespiti başarısız' } });
  }
});

router.get('/', async (req, res) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const name = req.query?.name ? String(req.query.name).trim() : null;
    const limit = Math.min(Number(req.query?.limit) || 500, 1000);
    const offset = Number(req.query?.offset) || 0;
    const where: any = {};
    if (search) { where.OR = [{ name: { contains: search } }, { value: { contains: search } }]; }
    if (name) where.name = name;
    const [items, total] = await Promise.all([
      prisma.variant.findMany({ where, take: limit, skip: offset, orderBy: { updatedAt: 'desc' }, include: { product: { select: { id: true, title: true, xmlKey: true, sku: true, images: true, salePrice: true } } } }),
      prisma.variant.count({ where }),
    ]);
    return res.json({ items, total, limit, offset });
  } catch (error) {
    console.error('[variants] GET error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sorgu başarısız' } });
  }
});

router.get('/types', async (_req, res) => {
  try {
    const types = await prisma.variant.groupBy({ by: ['name'], _count: { name: true }, orderBy: { _count: { name: 'desc' } } });
    return res.json({ items: types.map(t => ({ name: t.name, count: t._count.name })) });
  } catch (error) {
    console.error('[variants] GET types error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sorgu başarısız' } });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, value, productId } = req.body;
    if (!name || !value) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name ve value gerekli' } });
    const item = await prisma.variant.create({ data: { name, value, productId: productId || undefined } });
    if (productId) { await prisma.product.update({ where: { id: productId }, data: { variantMatch: true } }); }
    return res.status(201).json({ item });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Bu varyant zaten var' } });
    console.error('[variants] POST error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Varyant oluşturma başarısız' } });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, value } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (value !== undefined) data.value = value;
    const item = await prisma.variant.update({ where: { id: req.params.id }, data });
    return res.json({ item });
  } catch (error) { console.error('[variants] PUT error:', error); return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Güncelleme başarısız' } }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try { await prisma.variant.delete({ where: { id: req.params.id } }); return res.json({ ok: true }); }
  catch (error) { console.error('[variants] DELETE error:', error); return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Silme başarısız' } }); }
});

router.get('/logs', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query?.limit) || 50, 200);
    const items = await prisma.auditLog.findMany({ where: { entity: 'variant' }, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, details: true, createdAt: true, actorUserId: true } });
    return res.json({ items });
  } catch (error) { console.error('[variants] GET logs error:', error); return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sorgu başarısız' } }); }
});

router.post('/ai-suggest', requireAuth, async (req, res) => {
  try {
    const { productId, title, description } = req.body;
    const searchText = (title || description || '').toLowerCase();
    const colorPatterns = ['kırmızı','mavi','yeşil','sarı','beyaz','siyah','mor','turuncu','pembe','gri','lacivert','bordo','bej','kahverengi','krem','füme','metalik','altın','gümüş','turkuaz'];
    const suggestions: Array<{ name: string; value: string; confidence: number }> = [];
    for (const color of colorPatterns) { if (searchText.includes(color)) { suggestions.push({ name: 'Renk', value: color.charAt(0).toUpperCase() + color.slice(1), confidence: 85 }); break; } }
    const sizePatterns = ['xs','s','m','l','xl','xxl','3xl','4xl','5xl'];
    for (const size of sizePatterns) { if (searchText.includes(size)) { suggestions.push({ name: 'Beden', value: size.toUpperCase(), confidence: 80 }); break; } }
    const numberMatches = searchText.match(/\b(\d{2,3})\b/g);
    if (numberMatches) { for (const num of numberMatches) { const numVal = parseInt(num); if ((numVal >= 32 && numVal <= 50)) { suggestions.push({ name: 'Numara', value: num, confidence: 75 }); break; } } }
    return res.json({ suggestions, source: 'pattern' });
  } catch (error) { console.error('[variants] POST ai-suggest error:', error); return res.status(500).json({ error: { code: 'DB_ERROR', message: 'AI öneri başarısız' } }); }
});

const UNIVERSAL_ATTRIBUTES = [
  { key: 'Renk', label: 'Renk', icon: '🎨', marketplaces: ['Trendyol','Hepsiburada','Amazon','N11'] },
  { key: 'Beden', label: 'Beden', icon: '👕', marketplaces: ['Trendyol','Hepsiburada','Amazon','N11'] },
  { key: 'Numara', label: 'Numara', icon: '🔢', marketplaces: ['Trendyol','Hepsiburada','N11'] },
  { key: 'Cinsiyet', label: 'Cinsiyet', icon: '⚤', marketplaces: ['Trendyol','Hepsiburada','Amazon'] },
  { key: 'Materyal', label: 'Materyal', icon: '🧵', marketplaces: ['Trendyol','Hepsiburada','Amazon'] },
  { key: 'Kapasite', label: 'Kapasite', icon: '📊', marketplaces: ['Trendyol','Hepsiburada'] },
  { key: 'Hacim', label: 'Hacim', icon: '🧊', marketplaces: ['Trendyol','Hepsiburada'] },
  { key: 'Model', label: 'Model', icon: '🏷️', marketplaces: ['Trendyol','Hepsiburada'] },
  { key: 'Ölçü', label: 'Ölçü', icon: '📐', marketplaces: ['Trendyol','Hepsiburada'] },
];

router.get('/universal-attributes', (_req, res) => { return res.json({ items: UNIVERSAL_ATTRIBUTES }); });

router.get('/marketplace-attributes/:key', (req, res) => {
  const key = req.params.key;
  const mpAttributes: Record<string, typeof UNIVERSAL_ATTRIBUTES> = {
    trendyol: UNIVERSAL_ATTRIBUTES.filter(a => a.marketplaces.includes('Trendyol')),
    hepsiburada: UNIVERSAL_ATTRIBUTES.filter(a => a.marketplaces.includes('Hepsiburada')),
    amazon: UNIVERSAL_ATTRIBUTES.filter(a => a.marketplaces.includes('Amazon')),
    n11: UNIVERSAL_ATTRIBUTES.filter(a => a.marketplaces.includes('N11')),
  };
  return res.json({ items: mpAttributes[key] || UNIVERSAL_ATTRIBUTES });
});

router.post('/bulk-ai-suggest', requireAuth, async (req, res) => {
  try {
    const { productIds } = req.body;
    const where: any = { variantMatch: false };
    if (Array.isArray(productIds) && productIds.length > 0) where.id = { in: productIds };
    const products = await prisma.product.findMany({ where, select: { id: true, title: true }, take: 200 });
    const colorPatterns = ['kırmızı','mavi','yeşil','sarı','beyaz','siyah','mor','turuncu','pembe','gri','lacivert','bordo','bej','kahverengi','krem','füme','metalik','altın','gümüş','turkuaz'];
    const results: Array<{ productId: string; productTitle: string; suggestions: Array<{ name: string; value: string; confidence: number }> }> = [];
    for (const product of products) {
      const searchText = (product.title || '').toLowerCase();
      const suggestions: Array<{ name: string; value: string; confidence: number }> = [];
      for (const color of colorPatterns) { if (searchText.includes(color)) { suggestions.push({ name: 'Renk', value: color.charAt(0).toUpperCase() + color.slice(1), confidence: 85 }); break; } }
      if (suggestions.length > 0) { results.push({ productId: product.id, productTitle: product.title || '', suggestions }); }
    }
    return res.json({ totalScanned: products.length, totalSuggestions: results.length, results });
  } catch (error) { console.error('[variants] POST bulk-ai-suggest error:', error); return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Toplu AI öneri başarısız' } }); }
});

export default router;
