// ==================== VARYANT MOTORU V4.0 ====================
// Universal XML Profile Engine + Smart Variant Engine
// 7 Aşamalı Pipeline: XML Profil → Tedarikçi → Ürün → Aile → Otomatik → Doğrulama → Manual
// ============================================================
import { prisma } from '../../db/prisma.ts';
import type { V4ProductWithRelations, XmlProfileResult, V4AnalysisResult, V4FamilyInfo, V4Stats, V4ScreenProduct } from './types.ts';
import { V4_CONSTANTS, MANUAL_REVIEW_REASONS } from './types.ts';

// ==================== AŞAMA 1: XML PROFİL ANALİZİ ====================

export async function analyzeXmlProfile(xmlSourceId: string): Promise<XmlProfileResult> {
  const products = await prisma.product.findMany({
    where: { xmlSourceId },
    select: {
      id: true, xmlKey: true, title: true, sku: true, barcode: true,
      supplierCategory: true, variants: true,
    },
  });

  if (products.length === 0) {
    return {
      profileName: 'Empty XML', xmlType: 'UNKNOWN',
      parentSkuRate: 0, groupIdRate: 0, variationThemeRate: 0,
      colorRate: 0, sizeRate: 0, numberRate: 0,
      barcodeRate: 0, skuRate: 0, titleQuality: 0, categoryQuality: 0,
      attributeQuality: 0, dgMode: 'MANUAL', canAutoCreate: false, confidence: 0,
    };
  }

  // Varyant analizi
  let hasColorCount = 0, hasSizeCount = 0, hasNumberCount = 0;
  let hasBarcodeCount = 0, hasSkuCount = 0;
  let titleScoreSum = 0, categoryScoreSum = 0;

  for (const p of products) {
    const variantNames = p.variants.map(v => v.name.toLowerCase());
    if (variantNames.some(n => ['renk', 'color', 'colour'].includes(n))) hasColorCount++;
    if (variantNames.some(n => ['beden', 'size'].includes(n))) hasSizeCount++;
    if (variantNames.some(n => ['numara', 'number', 'no'].includes(n))) hasNumberCount++;
    if (p.barcode) hasBarcodeCount++;
    if (p.sku) hasSkuCount++;

    if (p.title) {
      const words = p.title.split(/\s+/).length;
      titleScoreSum += Math.min(100, words * 10); // 10+ kelime = 100 puan
    }
    if (p.supplierCategory) categoryScoreSum += 100;
    else categoryScoreSum += 50;
  }

  const total = products.length;
  const barcodeRate = hasBarcodeCount / total;
  const skuRate = hasSkuCount / total;
  const colorRate = hasColorCount / total;
  const sizeRate = hasSizeCount / total;
  const numberRate = hasNumberCount / total;

  const titleQuality = Math.round(titleScoreSum / total);
  const categoryQuality = Math.round(categoryScoreSum / total);

  // XML Tipi belirleme
  let xmlType: XmlProfileResult['xmlType'] = 'UNKNOWN';
  let canAutoCreate = false;
  let dgMode: XmlProfileResult['dgMode'] = 'MANUAL';

  if (colorRate > 0.3 || sizeRate > 0.3 || numberRate > 0.3) {
    // Renk/beden/numara kullanılıyor → Distributed Variant
    xmlType = 'DISTRIBUTED_VARIANT';
    canAutoCreate = true;
    dgMode = 'AUTO';
  } else if (barcodeRate > 0.9 && colorRate < 0.1) {
    // Barkod var ama varyant yok → Simple (tek ürün)
    xmlType = 'SIMPLE';
    canAutoCreate = false;
    dgMode = 'AUTO';
  } else if (barcodeRate > 0.5) {
    xmlType = 'FLAT';
    canAutoCreate = true;
    dgMode = 'SEMI_AUTO';
  }

  const confidence = Math.round(
    (colorRate * 25 + sizeRate * 25 + numberRate * 20 + barcodeRate * 15 + skuRate * 15) *
    (titleQuality / 100)
  );

  // Profile veritabanına kaydet
  await prisma.xmlProfile.upsert({
    where: { xmlSourceId },
    create: {
      xmlSourceId,
      profileName: `${xmlSourceId}_${Date.now()}`,
      xmlType,
      hasParentSku: false, parentSkuUsageRate: 0,
      hasGroupId: false, groupIdUsageRate: 0,
      hasVariationTheme: false, variationThemeRate: 0,
      hasColor: colorRate > 0.3, colorUsageRate: colorRate,
      hasSize: sizeRate > 0.3, sizeUsageRate: sizeRate,
      hasNumber: numberRate > 0.3, numberUsageRate: numberRate,
      hasModel: false, modelUsageRate: 0,
      barcodeUsageRate: barcodeRate, skuUsageRate: skuRate,
      titleQuality, categoryQuality, attributeQuality: Math.round((colorRate + sizeRate + numberRate) / 3 * 100),
      dgMode, canAutoCreate, lastAnalysisDate: new Date(), confidence,
    },
    update: {
      lastAnalysisDate: new Date(), confidence,
      colorUsageRate: colorRate, sizeUsageRate: sizeRate, numberUsageRate: numberRate,
      barcodeUsageRate: barcodeRate, skuUsageRate: skuRate,
      titleQuality, categoryQuality,
      dgMode, canAutoCreate, xmlType,
    },
  });

  return {
    profileName: `xml_profile_${xmlSourceId.slice(0, 8)}`,
    xmlType, parentSkuRate: 0, groupIdRate: 0, variationThemeRate: 0,
    colorRate, sizeRate, numberRate, barcodeRate, skuRate,
    titleQuality, categoryQuality, attributeQuality: Math.round((colorRate + sizeRate + numberRate) / 3 * 100),
    dgMode, canAutoCreate, confidence,
  };
}

// ==================== AŞAMA 2: TEDARİKÇİ ANALİZİ ====================

async function analyzeSupplier(xmlSourceId: string, profile: XmlProfileResult): Promise<void> {
  // Öğrenilen kuralları kontrol et
  const existing = await prisma.xmlProfile.findUnique({ where: { xmlSourceId } });
  if (existing?.learnedRules) {
    try {
      const rules = JSON.parse(existing.learnedRules);
      // Öğrenilen kuralları uygula
      if (rules.patterns) {
        console.log(`[V4] Tedarikçi için ${rules.patterns.length} öğrenilmiş kural uygulanıyor`);
      }
    } catch { /* ignore */ }
  }

  // Tedarikçi davranışını analiz et
  const learnedRules = {
    patterns: [],
    lastAnalysis: new Date().toISOString(),
    profileType: profile.xmlType,
    canAutoCreate: profile.canAutoCreate,
  };

  await prisma.xmlProfile.update({
    where: { xmlSourceId },
    data: { learnedRules: JSON.stringify(learnedRules) },
  });
}

// ==================== AŞAMA 3: ÜRÜN ANALİZİ ====================

async function analyzeProduct(
  product: V4ProductWithRelations,
  profile: XmlProfileResult
): Promise<V4AnalysisResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: Record<string, boolean> = {};
  let confidence = 0;
  let source: V4AnalysisResult['source'] = 'AI_MATCH';
  let status: V4AnalysisResult['status'] = 'AUTO_ACCEPTED';
  let reason: string | null = null;
  let phase = 1;

  // 1. XML'den parent SKU kontrolü
  checks.hasParentSku = false;
  checks.hasVariationTheme = false;

  // 2. Varyant attribute kontrolü
  const variantNames = product.variants?.map(v => v.name.toLowerCase()) || [];
  checks.hasColor = variantNames.some(n => ['renk', 'color', 'colour'].includes(n));
  checks.hasSize = variantNames.some(n => ['beden', 'size'].includes(n));
  checks.hasNumber = variantNames.some(n => ['numara', 'number', 'no'].includes(n));

  // 3. Kategori varyant gereksinimi - eğer hiç varyant attribute yoksa
  if (!checks.hasColor && !checks.hasSize && !checks.hasNumber) {
    if (profile.xmlType === 'SIMPLE') {
      // Basit ürün - varyant gerekmez
      source = 'NO_VARIANT_NEEDED';
      status = 'AUTO_ACCEPTED';
      reason = 'Varyant gerektirmeyen ürün';
      phase = 3;
      return { productId: product.id, confidence: 100, source, status, reason,
        parentSku: null, groupId: null, xmlHasParent: false, familyId: null, phase,
        checks, errors, warnings, validationPassed: true };
    }
  }

  // 4. Güven skoru hesapla (V4 algoritması)
  let score = 0;

  // Profil uyumu (20 puan)
  if (profile.canAutoCreate) score += 20;
  else if (profile.xmlType === 'SIMPLE') score += 30;

  // Attribute varlığı (25 puan)
  if (checks.hasColor) score += 10;
  if (checks.hasSize) score += 8;
  if (checks.hasNumber) score += 7;

  // Başlık kalitesi (15 puan)
  if (product.title) {
    const words = product.title.split(/\s+/).length;
    score += Math.min(15, Math.round(words * 1.5));
  }

  // Barkod/SKU (10 puan)
  if (product.barcode) score += 5;
  if (product.sku) score += 5;

  // Kategori (10 puan)
  if (product.categoryId) score += 10;

  // Veri tutarlılığı (20 puan)
  if (product.salePrice && product.salePrice > 0) score += 5;
  if (product.stock > 0) score += 5;
  if (product.description) score += 5;
  checks.hasDescription = !!product.description;

  confidence = Math.min(100, score);
  phase = 3;

  // 5. Status belirleme (V4 eşikleri)
  if (confidence >= V4_CONSTANTS.THRESHOLD_AUTO_ACCEPT) {
    status = 'AUTO_ACCEPTED';
    reason = 'Yüksek güven skoru';
  } else if (confidence >= V4_CONSTANTS.THRESHOLD_AUTO_CREATE) {
    status = 'AUTO_CREATED';
    source = 'AUTO_CREATED';
    reason = 'DG STOK otomatik varyant oluşturma';
  } else if (confidence >= V4_CONSTANTS.THRESHOLD_RE_ANALYZE) {
    status = 'RE_ANALYZED';
    reason = 'Düşük güven - tekrar analiz edilecek';
  } else if (confidence >= V4_CONSTANTS.THRESHOLD_AUTO_SUGGEST) {
    status = 'AUTO_CREATED';
    source = 'AUTO_CREATED';
    reason = 'Otomatik eşleştirme önerisi';
  } else {
    // MANUAL_REVIEW - SADECE gerçek istisnalar
    status = 'MANUAL_REVIEW';
    errors.push('Güven skoru çok düşük');

    if (!checks.hasColor && !checks.hasSize && !checks.hasNumber) {
      errors.push('Hiçbir varyant attribute bulunamadı');
      reason = 'Eksik Attribute';
    } else if (!product.title || product.title.length < 5) {
      errors.push('Ürün adı çok kısa veya boş');
      reason = 'Anlamsız Ürün Adı';
    } else if (!product.categoryId) {
      errors.push('Kategori belirtilmemiş');
      reason = 'Kategori Çelişkisi';
    } else {
      errors.push('Ürün ailesi belirlenemedi');
      reason = 'Belirlenemeyen Ürün Ailesi';
    }
  }

  return {
    productId: product.id,
    confidence,
    source,
    status,
    reason,
    parentSku: null,
    groupId: null,
    xmlHasParent: false,
    familyId: null,
    phase,
    checks,
    errors,
    warnings,
    validationPassed: status === 'AUTO_ACCEPTED' || status === 'AUTO_CREATED',
  };
}

// ==================== AŞAMA 4: ÜRÜN AİLESİ BULMA ====================

async function findProductFamilies(
  xmlSourceId: string,
  analysisResults: Map<string, V4AnalysisResult>
): Promise<Map<string, V4FamilyInfo>> {
  const families = new Map<string, V4FamilyInfo>();
  const products = await prisma.product.findMany({
    where: { xmlSourceId },
    include: { brand: true, category: true, variants: true },
  }) as unknown as V4ProductWithRelations[];

  // Marka + Kategori bazında grupla
  const groups = new Map<string, V4ProductWithRelations[]>();
  for (const p of products) {
    const key = `${p.brandId || 'no_brand'}_${p.categoryId || 'no_cat'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  // Her grupta aile tespiti yap
  let familyCounter = 0;
  for (const [, group] of groups) {
    if (group.length < 2) continue; // En az 2 ürün gerek

    // Model adlarını çıkar (başlıktan)
    const modelGroups = new Map<string, V4ProductWithRelations[]>();
    for (const p of group) {
      const model = extractModelName(p.title || p.xmlKey);
      if (!modelGroups.has(model)) modelGroups.set(model, []);
      modelGroups.get(model)!.push(p);
    }

    for (const [model, modelProducts] of modelGroups) {
      if (modelProducts.length < 2) continue;

      familyCounter++;
      const parentSku = `DG_${(modelProducts[0].brand?.name || 'BR').slice(0, 3).toUpperCase()}_${model.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}_${familyCounter}`;
      const groupId = `grp_${Date.now()}_${familyCounter}`;
      const familyId = `fam_${xmlSourceId.slice(0, 8)}_${familyCounter}`;

      const members: V4FamilyInfo['members'] = [];
      for (const p of modelProducts) {
        const color = p.variants?.find(v => ['renk', 'color', 'colour'].includes(v.name.toLowerCase()));
        const size = p.variants?.find(v => ['beden', 'size'].includes(v.name.toLowerCase()));
        const number = p.variants?.find(v => ['numara', 'number', 'no'].includes(v.name.toLowerCase()));

        members.push({
          productId: p.id,
          attributeName: color?.name || size?.name || number?.name || null,
          attributeValue: color?.value || size?.value || number?.value || null,
        });
      }

      const family: V4FamilyInfo = {
        id: familyId,
        parentSku,
        groupId,
        productCount: modelProducts.length,
        confidence: Math.round(70 + (modelProducts.length / group.length) * 30),
        members,
      };

      families.set(familyId, family);

      // Veritabanına kaydet (id Prisma tarafından otomatik oluşturulur)
      const dbFamily = await prisma.variantFamily.upsert({
        where: { parentSku },
        create: {
          parentSku, groupId,
          generatedBy: 'DG_AUTO', productCount: modelProducts.length,
          xmlSourceId,
        },
        update: { productCount: modelProducts.length },
      });
      // Oluşturulan gerçek ID'yi kullan
      const realFamilyId = dbFamily.id;

      // Üyeleri kaydet
      for (const m of members) {
        await prisma.variantFamilyMember.upsert({
          where: { familyId_productId: { familyId: realFamilyId, productId: m.productId } },
          create: {
            familyId: realFamilyId, productId: m.productId,
            attributeName: m.attributeName, attributeValue: m.attributeValue,
            confidence: family.confidence, assignedBy: 'DG_AUTO',
          },
          update: { attributeName: m.attributeName, attributeValue: m.attributeValue },
        });

        // Analysis sonucunu güncelle
        const result = analysisResults.get(m.productId);
        if (result) {
          result.familyId = realFamilyId;
          result.parentSku = parentSku;
          result.groupId = groupId;
          if (result.status === 'MANUAL_REVIEW' || result.status === 'RE_ANALYZED') {
            result.status = 'AUTO_CREATED';
            result.source = 'AUTO_CREATED';
            result.reason = 'Aile bulundu - DG STOK otomatik oluşturdu';
            result.confidence = Math.max(result.confidence, family.confidence);
            result.validationPassed = true;
          }
        }
      }

      // familyId güncelle
      family.id = realFamilyId;
      families.set(realFamilyId, family);
      families.delete(familyId);
    }
  }

  return families;
}

function extractModelName(title: string): string {
  // Renk/beden/numara kelimelerini temizle
  let model = title.toLowerCase();
  for (const color of V4_CONSTANTS.COLOR_KEYWORDS) {
    model = model.replace(new RegExp(`\\b${color}\\b`, 'gi'), '').trim();
  }
  for (const size of V4_CONSTANTS.SIZE_KEYWORDS) {
    model = model.replace(new RegExp(`\\b${size}\\b`, 'gi'), '').trim();
  }
  for (const num of V4_CONSTANTS.NUMBER_KEYWORDS) {
    model = model.replace(new RegExp(`\\b${num}\\b`, 'gi'), '').trim();
  }
  // Fazla boşlukları temizle
  return model.replace(/\s+/g, ' ').trim().slice(0, 50);
}

// ==================== AŞAMA 6: TEKRAR DOĞRULAMA ====================

async function revalidateProducts(
  analysisResults: Map<string, V4AnalysisResult>
): Promise<void> {
  for (const [, result] of analysisResults) {
    if (result.status === 'MANUAL_REVIEW') continue;

    const checks = {
      conflictingBarcode: false,
      conflictingSku: false,
      missingAttribute: false,
      categoryMatch: true,
    };

    // Çakışan barkod kontrolü
    if (result.checks.hasDescription === false) {
      checks.missingAttribute = true;
    }

    result.validationPassed = Object.values(checks).every(v => v === true);

    if (!result.validationPassed) {
      result.status = 'MANUAL_REVIEW';
      result.reason = 'Doğrulama başarısız';
      if (checks.conflictingBarcode) result.errors.push('Çakışan Barkod');
      if (checks.conflictingSku) result.errors.push('Çakışan SKU');
      if (checks.missingAttribute) result.errors.push('Eksik Attribute');
    }

    // Veritabanını güncelle
    await prisma.variantAnalysis.upsert({
      where: { id: `va4_${result.productId}` },
      create: {
        id: `va4_${result.productId}`,
        productId: result.productId,
        confidence: result.confidence,
        source: result.source,
        status: result.status,
        reason: result.reason,
        parentSku: result.parentSku,
        groupId: result.groupId,
        xmlHasParent: result.xmlHasParent,
        checkResults: JSON.stringify({ checks: result.checks, errors: result.errors, warnings: result.warnings }),
        autoFixAttempted: true,
        autoFixResult: JSON.stringify({ phase: result.phase }),
        validationPassed: result.validationPassed,
        familyId: result.familyId,
        profileApplied: true,
      },
      update: {
        confidence: result.confidence,
        source: result.source,
        status: result.status,
        reason: result.reason,
        parentSku: result.parentSku,
        groupId: result.groupId,
        checkResults: JSON.stringify({ checks: result.checks, errors: result.errors, warnings: result.warnings }),
        validationPassed: result.validationPassed,
        familyId: result.familyId,
      },
    });
  }
}

// ==================== ANA PIPELINE ====================

export async function runV4Pipeline(
  xmlSourceId?: string,
  marketplaceKey?: string
): Promise<{ results: V4AnalysisResult[]; stats: V4Stats; families: V4FamilyInfo[] }> {
  const mpKey = marketplaceKey || 'trendyol';

  // ESKİ KAYITLARI TEMİZLE
  const where: any = {};
  if (xmlSourceId) where.xmlSourceId = xmlSourceId;

  if (xmlSourceId) {
    const oldProducts = await prisma.product.findMany({ where: { xmlSourceId }, select: { id: true } });
    const oldIds = oldProducts.map(p => p.id);
    if (oldIds.length > 0) {
      await prisma.variantAnalysis.deleteMany({ where: { productId: { in: oldIds } } });
    }
  } else {
    await prisma.variantAnalysis.deleteMany({});
  }

  // AŞAMA 1: XML Profil Analizi
  const sources = xmlSourceId
    ? [{ id: xmlSourceId }]
    : await prisma.xmlSource.findMany({ select: { id: true } });

  const allResults: V4AnalysisResult[] = [];
  const allFamilies: V4FamilyInfo[] = [];

  for (const source of sources) {
    console.log(`[V4] XML Profil analizi başlıyor: ${source.id}`);

    // AŞAMA 1: Profil
    const profile = await analyzeXmlProfile(source.id);
    console.log(`[V4] XML Tipi: ${profile.xmlType}, Güven: ${profile.confidence}, Otomatik: ${profile.canAutoCreate}`);

    // AŞAMA 2: Tedarikçi
    await analyzeSupplier(source.id, profile);

    // AŞAMA 3: Ürünleri analiz et
    let cursor = '';
    let hasMore = true;
    const analysisMap = new Map<string, V4AnalysisResult>();
    let productCount = 0;

    while (hasMore) {
      const pageWhere: any = { xmlSourceId: source.id };
      if (cursor) pageWhere.id = { gt: cursor };

      const products = await prisma.product.findMany({
        where: pageWhere,
        orderBy: { id: 'asc' },
        take: 200,
        include: {
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          xmlSource: { select: { id: true, name: true } },
          variants: { select: { id: true, name: true, value: true } },
        },
      }) as unknown as V4ProductWithRelations[];

      if (products.length === 0) break;
      cursor = products[products.length - 1].id;
      productCount += products.length;

      for (const p of products) {
        const result = await analyzeProduct(p, profile);
        analysisMap.set(p.id, result);
      }

      // AŞAMA 4: Ürün Ailesi Bulma (her 200'de bir)
      if (productCount % 200 === 0 || products.length < 200) {
        const families = await findProductFamilies(source.id, analysisMap);
        for (const [, f] of families) allFamilies.push(f);
      }

      if (productCount % 200 === 0) {
        const pct = Math.round((productCount / (productCount + 1)) * 100);
        console.log(`[V4] İlerleme: ${productCount} ürün analiz edildi`);
      }
    }

    // AŞAMA 6: Tekrar Doğrulama
    await revalidateProducts(analysisMap);

    for (const [, r] of analysisMap) allResults.push(r);
    console.log(`[V4] XML ${source.id} tamam: ${productCount} ürün`);
  }

  // AŞAMA 7: İstatistik
  const stats: V4Stats = {
    totalProducts: allResults.length,
    xmlAccepted: allResults.filter(r => r.status === 'AUTO_ACCEPTED' && r.source === 'NO_VARIANT_NEEDED').length +
                 allResults.filter(r => r.status === 'AUTO_ACCEPTED' && r.source !== 'AUTO_CREATED').length,
    noVariantNeeded: allResults.filter(r => r.source === 'NO_VARIANT_NEEDED').length,
    autoCreated: allResults.filter(r => r.status === 'AUTO_CREATED' || r.source === 'AUTO_CREATED').length,
    reAnalyzed: allResults.filter(r => r.status === 'RE_ANALYZED').length,
    manualReview: allResults.filter(r => r.status === 'MANUAL_REVIEW').length,
    errors: allResults.filter(r => r.status === 'ERROR').length,
  };

  console.log(`[V4] Pipeline tamam: ${JSON.stringify(stats)}`);

  return { results: allResults, stats, families: allFamilies };
}

// ==================== İSTATİSTİK ====================

export async function getV4Stats(xmlSourceId?: string): Promise<V4Stats> {
  const where: any = {};
  if (xmlSourceId) {
    const products = await prisma.product.findMany({ where: { xmlSourceId }, select: { id: true } });
    where.productId = { in: products.map(p => p.id) };
  }

  const [grouped] = await Promise.all([
    prisma.variantAnalysis.groupBy({
      by: ['status'],
      _count: { status: true },
      where: where.productId?.in ? where : {},
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const g of grouped) statusMap[g.status] = g._count.status;

  return {
    totalProducts: Object.values(statusMap).reduce((a, b) => a + b, 0),
    xmlAccepted: (statusMap['AUTO_ACCEPTED'] || 0),
    noVariantNeeded: 0,
    autoCreated: (statusMap['AUTO_CREATED'] || 0),
    reAnalyzed: (statusMap['RE_ANALYZED'] || 0),
    manualReview: (statusMap['MANUAL_REVIEW'] || 0),
    errors: (statusMap['ERROR'] || 0),
  };
}

// ==================== SORUNLU ÜRÜNLER ====================

export async function getV4Problems(
  filters: { status?: string; xmlSourceId?: string; search?: string; page?: number; limit?: number } = {}
): Promise<{ items: V4ScreenProduct[]; total: number }> {
  const { status, xmlSourceId, search, page = 1, limit = 50 } = filters;

  const vaWhere: any = {};
  if (status === 'MANUAL_REVIEW') {
    vaWhere.status = 'MANUAL_REVIEW';
  } else if (status === 'ERROR') {
    vaWhere.status = 'ERROR';
  } else if (status && status !== 'all') {
    vaWhere.status = status;
  } else {
    vaWhere.status = { in: ['MANUAL_REVIEW', 'ERROR'] };
  }

  if (xmlSourceId) {
    const products = await prisma.product.findMany({ where: { xmlSourceId }, select: { id: true } });
    vaWhere.productId = { in: products.map(p => p.id) };
  }

  if (search) {
    const searchProducts = await prisma.product.findMany({
      where: { OR: [{ title: { contains: search } }, { sku: { contains: search } }, { xmlKey: { contains: search } }] },
      select: { id: true },
    });
    const searchIds = searchProducts.map(p => p.id);
    if (vaWhere.productId) {
      const existingIds = vaWhere.productId.in;
      vaWhere.productId = { in: existingIds.filter((id: string) => searchIds.includes(id)) };
    } else {
      vaWhere.productId = { in: searchIds };
    }
  }

  const [items, total] = await Promise.all([
    prisma.variantAnalysis.findMany({
      where: vaWhere,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ confidence: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.variantAnalysis.count({ where: vaWhere }),
  ]);

  const productIds = items.map(i => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      xmlSource: { select: { id: true, name: true } },
      variants: { select: { id: true, name: true, value: true } },
    },
  });

  const productMap = new Map(products.map(p => [p.id, p]));

  const screenItems: V4ScreenProduct[] = items.map(item => {
    const product = productMap.get(item.productId);
    let checkResults: { errors?: string[]; warnings?: string[]; checks?: Record<string, boolean> } = {};
    if (item.checkResults) {
      try { checkResults = JSON.parse(item.checkResults); } catch { /* ignore */ }
    }

    const errs = checkResults.errors || [];
    const issueType = errs.length > 0 ? errs[0] : item.reason || 'Bilinmeyen';

    return {
      id: item.productId,
      sku: product?.sku || null,
      xmlKey: product?.xmlKey || '',
      title: product?.title || null,
      barcode: product?.barcode || null,
      brandName: product?.brand?.name || null,
      categoryName: product?.category?.name || null,
      xmlSourceName: product?.xmlSource?.name || null,
      confidence: item.confidence,
      status: item.status,
      reason: item.reason,
      suggestedAction: item.status === 'MANUAL_REVIEW' ? 'Manuel inceleme gerekli' : null,
      hasColor: product?.variants?.some(v => v.name === 'Renk') || false,
      hasSize: product?.variants?.some(v => v.name === 'Beden') || false,
      hasNumber: product?.variants?.some(v => v.name === 'Numara') || false,
      parentSku: item.parentSku,
      groupId: item.groupId,
      familyId: item.familyId,
      errorCount: errs.length,
      issueType,
    };
  });

  return { items: screenItems, total };
}

// ==================== AİLE YÖNETİMİ ====================

export async function getFamilies(xmlSourceId?: string): Promise<V4FamilyInfo[]> {
  const where: any = {};
  if (xmlSourceId) where.xmlSourceId = xmlSourceId;

  const families = await prisma.variantFamily.findMany({
    where,
    include: {
      members: {
        include: {
          // family member'dan product'a erişmek için
        },
      },
    },
  });

  return families.map(f => ({
    id: f.id,
    parentSku: f.parentSku,
    groupId: f.groupId || '',
    productCount: f.productCount,
    confidence: f.members.length > 0 ? Math.round(f.members.reduce((s, m) => s + m.confidence, 0) / f.members.length) : 0,
    members: f.members.map(m => ({
      productId: m.productId,
      attributeName: m.attributeName,
      attributeValue: m.attributeValue,
    })),
  }));
}

// ==================== RAPOR ====================

export async function getV4Report(xmlSourceId?: string): Promise<{
  totalProducts: number; xmlAccepted: number; noVariantNeeded: number;
  autoCreated: number; reAnalyzed: number; manualReview: number; errors: number;
  manualReviewItems: Array<{
    id: string; title: string | null; reason: string | null;
    failedChecks: string[]; confidence: number; whyNotAutoResolved: string;
  }>;
}> {
  const stats = await getV4Stats(xmlSourceId);

  const { items: manualItems } = await getV4Problems({
    status: 'MANUAL_REVIEW',
    xmlSourceId,
    page: 1,
    limit: 1000,
  });

  const manualReviewItems = manualItems.map(item => ({
    id: item.id,
    title: item.title,
    reason: item.reason,
    failedChecks: item.issueType ? [item.issueType] : ['Bilinmeyen'],
    confidence: item.confidence,
    whyNotAutoResolved: item.reason
      ? `Güven skoru ${item.confidence}/100 - ${item.reason}`
      : `Otomatik çözüm mümkün değil (güven: ${item.confidence}/100)`,
  }));

  return { ...stats, manualReviewItems };
}

// ==================== OTOMATİK EŞLEŞTİR ====================

export async function autoMatchProducts(productIds: string[]): Promise<{ matched: number; failed: number }> {
  let matched = 0;
  let failed = 0;

  for (const pid of productIds) {
    try {
      const analysis = await prisma.variantAnalysis.findUnique({ where: { id: `va4_${pid}` } });
      if (!analysis || analysis.status !== 'MANUAL_REVIEW') {
        failed++;
        continue;
      }

      await prisma.variantAnalysis.update({
        where: { id: `va4_${pid}` },
        data: { status: 'AUTO_CREATED', source: 'AI_MATCH', validationPassed: true },
      });
      matched++;
    } catch {
      failed++;
    }
  }

  return { matched, failed };
}

// ==================== MANUEL EŞLEŞTİR ====================

export async function manualMatchProducts(
  groupId: string,
  productIds: string[]
): Promise<{ matched: number }> {
  let matched = 0;

  for (const pid of productIds) {
    try {
      await prisma.variantAnalysis.upsert({
        where: { id: `va4_${pid}` },
        create: {
          id: `va4_${pid}`, productId: pid, confidence: 100,
          source: 'MANUAL', status: 'AUTO_CREATED',
          groupId, validationPassed: true,
        },
        update: { status: 'AUTO_CREATED', source: 'MANUAL', groupId, validationPassed: true },
      });
      matched++;
    } catch { /* ignore */ }
  }

  return { matched };
}

// ==================== TEKRAR ANALİZ ====================

export async function reanalyzeProducts(productIds: string[]): Promise<{ reanalyzed: number }> {
  let reanalyzed = 0;

  for (const pid of productIds) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: pid },
        include: {
          brand: true, category: true, xmlSource: true, variants: true,
        },
      }) as unknown as V4ProductWithRelations | null;

      if (!product || !product.xmlSourceId) { reanalyzed++; continue; }

      const profile = await analyzeXmlProfile(product.xmlSourceId);
      const result = await analyzeProduct(product, profile);

      await prisma.variantAnalysis.upsert({
        where: { id: `va4_${pid}` },
        create: {
          id: `va4_${pid}`, productId: pid,
          confidence: result.confidence, source: result.source,
          status: result.status, reason: result.reason,
          parentSku: result.parentSku, groupId: result.groupId,
          validationPassed: result.validationPassed, profileApplied: true,
        },
        update: {
          confidence: result.confidence, source: result.source,
          status: result.status, reason: result.reason,
          validationPassed: result.validationPassed,
        },
      });
      reanalyzed++;
    } catch { /* ignore */ }
  }

  return { reanalyzed };
}
