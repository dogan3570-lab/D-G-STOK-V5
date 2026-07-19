// ==================== VARYANT MOTORU V2 CORE ====================
// DG STOK V5.0 - Faz 1
//
// Bu motor, mevcut V4 ve V5 motorlarinin yerine gecmez.
// Feature flag (VARIANT_ENGINE=v2) ile aktif edilir.
//
// Yeni mantik:
//   1. XML'de varyant bilgisi var mi? -> Gecerli mi? -> AUTO_ACCEPTED
//   2. Kategori varyant gerektiriyor mu? -> Hayir: VARIANTSIZ_KABUL
//   3. Pazaryeri zorunlu tutuyor mu? -> Hayir: VARIANTSIZ_KABUL
//   4. Ayni urun daha once varyantsiz gonderilmis mi? -> VARIANTSIZ_KABUL
//   5. AI guven skoru >= %85 mi? -> AI onerisi uygula
//   6. MANUAL_REVIEW (son secenek)
// ================================================================

import { prisma } from '../../db/prisma.ts';
import { env } from '../../env.ts';
import type { VariantAnalysisV2, VariantDecision, VariantCheck } from './types.ts';

export interface VariantAnalysisInput {
  productId: string;
  xmlKey: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  brandId: string | null;
  description: string | null;
  xmlSourceId?: string | null;
  existingVariants: Array<{ name: string; value: string }>;
  marketplaceState?: Array<{ marketplaceKey: string; status: string }>;
}

/**
 * Varyant analizini calistirir
 */
export async function analyzeVariantV2(
  input: VariantAnalysisInput
): Promise<VariantAnalysisV2> {
  const checks: VariantCheck[] = [];
  let decision: VariantDecision = 'NO_VARIANT_NEEDED';
  let confidence = 100;
  const reasons: string[] = [];

  // === KONTROL 1: XML'de varyant bilgisi var mi? ===
  const hasXmlVariants = input.existingVariants.length > 0;
  checks.push({
    name: 'xml_variant_check',
    passed: hasXmlVariants,
    detail: hasXmlVariants
      ? `${input.existingVariants.length} varyant bulundu`
      : 'XML\'de varyant bilgisi yok',
  });

  // KURAL 1 & 5: XML'de gerçek varyant yoksa ürün NORMAL ÜRÜN kabul edilir.
  // Kullanıcıdan manuel varyant istenmez, Manual Review oluşturulmaz.
  if (!hasXmlVariants) {
    decision = 'NO_VARIANT_NEEDED';
    confidence = 100;
    reasons.push('XML\'de varyant bilgisi bulunamadı. Ürün varyantsız kabul edildi.');
    return buildResult(input.productId, decision, confidence, reasons, checks, 'xml');
  }

  // KURAL 6: Gerçek varyant tespit edildi, varyantlar gecerli mi?
  const validVariants = input.existingVariants.filter(
    v => v.name && v.name.length > 0 && v.value && v.value.length > 0
  );
  if (validVariants.length > 0) {
    decision = 'AUTO_ACCEPTED';
    confidence = 95;
    reasons.push(`XML'de ${validVariants.length} gecerli varyant bulundu`);
    return buildResult(input.productId, decision, confidence, reasons, checks, 'xml');
  }

  // === KONTROL 2: Kategori varyant gerektiriyor mu? ===
  let categoryVariantRequired = true;
  if (input.categoryId) {
    try {
      const category = await prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { variantRequired: true, name: true },
      });
      if (category) {
        categoryVariantRequired = category.variantRequired;
        checks.push({
          name: 'category_variant_check',
          passed: !categoryVariantRequired,
          detail: `Kategori: ${category.name}, Varyant gereksinimi: ${categoryVariantRequired ? 'Evet' : 'Hayir'}`,
        });
        if (!categoryVariantRequired) {
          decision = 'NO_VARIANT_NEEDED';
          confidence = 100;
          reasons.push(`Kategori "${category.name}" varyant gerektirmiyor`);
          return buildResult(input.productId, decision, confidence, reasons, checks, 'manual');
        }
      }
    } catch { /* ignore */ }
  }

  // === KONTROL 3: Pazaryeri zorunlu tutuyor mu? ===
  const marketplaceKeys = input.marketplaceState?.map(m => m.marketplaceKey) || [];
  if (marketplaceKeys.length > 0) {
    const rules = await prisma.marketplaceVariantRule.findMany({
      where: { marketplaceKey: { in: marketplaceKeys }, isActive: true },
      select: { marketplaceKey: true, variantGroupRequired: true },
    });

    const anyRequiresVariant = rules.some(r => r.variantGroupRequired);
    checks.push({
      name: 'marketplace_variant_check',
      passed: !anyRequiresVariant,
      detail: anyRequiresVariant
        ? 'Pazaryeri varyant zorunlu tutuyor'
        : 'Pazaryeri varyant zorunlu tutmuyor',
    });

    if (!anyRequiresVariant) {
      decision = 'VARIANTSIZ_KABUL';
      confidence = 90;
      reasons.push('Hedef pazaryerleri varyant zorunlu tutmuyor');
      return buildResult(input.productId, decision, confidence, reasons, checks, 'manual');
    }
  }

  // === KONTROL 4: Ayni urun daha once varyantsiz gonderilmis mi? ===
  if (input.barcode || input.sku) {
    const similarProducts = await prisma.product.findMany({
      where: {
        OR: [
          ...(input.barcode ? [{ barcode: input.barcode }] : []),
          ...(input.sku ? [{ sku: input.sku }] : []),
        ],
        id: { not: input.productId },
        status: { in: ['SENT', 'READY'] },
      },
      take: 1,
      select: { id: true, status: true },
    });

    const hasSentWithoutVariant = similarProducts.length > 0;
    checks.push({
      name: 'historical_variant_check',
      passed: hasSentWithoutVariant,
      detail: hasSentWithoutVariant
        ? 'Ayni urun daha once varyantsiz gonderilmis'
        : 'Benzer gonderi bulunamadi',
    });

    if (hasSentWithoutVariant) {
      decision = 'VARIANTSIZ_KABUL';
      confidence = 85;
      reasons.push('Ayni urun daha once varyantsiz basariyla gonderilmis');
      return buildResult(input.productId, decision, confidence, reasons, checks, 'manual');
    }
  }

  // === KONTROL 5: AI guven skoru ===
  const aiConfidence = await calculateAIConfidence(input);
  checks.push({
    name: 'ai_confidence_check',
    passed: aiConfidence >= 85,
    detail: `AI guven skoru: ${aiConfidence}/100`,
  });

  if (aiConfidence >= 85) {
    // AI varyant onerisi uret
    const suggestedVariants = await suggestVariants(input);
    if (suggestedVariants.length > 0) {
      decision = 'AUTO_CREATED';
      confidence = aiConfidence;
      reasons.push(`AI onerisi: ${suggestedVariants.map(v => `${v.name}:${v.value}`).join(', ')}`);
      return buildResult(input.productId, decision, confidence, reasons, checks, 'ai', suggestedVariants);
    }
  }

  // === KONTROL 6: MANUAL_REVIEW (son secenek) ===
  decision = 'MANUAL_REVIEW';
  confidence = Math.max(0, aiConfidence - 20);
  reasons.push('Tum otomatik kontroller basarisiz, manuel inceleme gerekli');
  return buildResult(input.productId, decision, confidence, reasons, checks, 'manual');
}

function buildResult(
  productId: string,
  decision: VariantDecision,
  confidence: number,
  reasons: string[],
  checks: VariantCheck[],
  source: 'xml' | 'ai' | 'manual',
  suggestedVariants?: Array<{ name: string; value: string }>
): VariantAnalysisV2 {
  return {
    productId,
    decision,
    confidence,
    reason: reasons.join(' -> '),
    checks,
    suggestedVariants,
    source,
  };
}

/**
 * AI guven skoru hesaplar (basit mantik)
 * - Urun adi ve aciklamasinda varyant ipuclari arar
 * - Kategori bazli varyant gereksinimini degerlendirir
 * - XML kaynagi gecmis basarisina bakar
 */
async function calculateAIConfidence(
  input: VariantAnalysisInput
): Promise<number> {
  let confidence = 50; // Baslangic: %50

  // Urun adinda varyant ipucu
  const title = input.title?.toLowerCase() || '';
  const description = input.description?.toLowerCase() || '';
  const combined = `${title} ${description}`;

  // Varyant anahtar kelimeleri
  const variantKeywords = [
    'renk', 'color', 'beden', 'size', 'numara', 'model',
    'ebat', 'olcu', 'cm', 'mm', 'lt', 'ml', 'kg', 'gr',
  ];

  const foundKeywords = variantKeywords.filter(k => combined.includes(k));
  if (foundKeywords.length > 0) {
    confidence += Math.min(30, foundKeywords.length * 10);
  }

  // Kategori bazli degerlendirme
  if (input.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { variantRequired: true, name: true },
    });
    if (category) {
      // Giyim, ayakkabi gibi kategoriler genelde varyantli
      const variantLikelyCategories = [
        'giyim', 'ayakkabi', 'ayakkabı', 'elbise', 'pantolon',
        'mont', 'ceket', 'gomlek', 'gömlek', 't-shirt', 'tshirt',
        'kazak', 'sort', 'şort', 'mayo', 'ic giyim', 'ic giyim',
      ];
      const isVariantLikely = variantLikelyCategories.some(c =>
        category.name.toLowerCase().includes(c)
      );
      if (!isVariantLikely && !category.variantRequired) {
        confidence += 20;
      }
    }
  }

  // XML kaynagi gecmis basarisi
  if (input.xmlSourceId) {
    // xmlSourceId'ye sahip urunlerin ID'lerini bul
    const sourceProducts = await prisma.product.findMany({
      where: { xmlSourceId: input.xmlSourceId },
      select: { id: true },
    });
    const sourceProductIds = sourceProducts.map(p => p.id);

    const successCount = await prisma.variantAnalysis.count({
      where: {
        productId: { in: sourceProductIds },
        status: { in: ['AUTO_ACCEPTED', 'AUTO_CREATED'] },
      },
    });
    const totalCount = sourceProductIds.length > 0
      ? await prisma.variantAnalysis.count({
          where: { productId: { in: sourceProductIds } },
        })
      : 0;
    if (totalCount > 0) {
      const successRate = (successCount / totalCount) * 100;
      confidence += Math.min(20, successRate * 0.2);
    }
  }

  return Math.min(100, Math.max(0, Math.round(confidence)));
}

/**
 * AI varyant onerisi uretir
 */
async function suggestVariants(
  input: VariantAnalysisInput
): Promise<Array<{ name: string; value: string }>> {
  const suggestions: Array<{ name: string; value: string }> = [];
  const title = input.title?.toLowerCase() || '';

  // Renk tespiti
  const colors = [
    'siyah', 'beyaz', 'kirmizi', 'kırmızı', 'mavi', 'yesil', 'yeşil',
    'sari', 'sarı', 'mor', 'turuncu', 'pembe', 'gri', 'lacivert',
    'bordo', 'bej', 'kahverengi', 'krem', 'fume', 'füme', 'metalik',
    'altin', 'altın', 'gumus', 'gümüş', 'turkuaz',
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'purple',
    'pink', 'gray', 'grey', 'brown', 'beige', 'navy', 'burgundy',
    'silver', 'gold', 'orange',
  ];

  const foundColor = colors.find(c => title.includes(c));
  if (foundColor) {
    suggestions.push({ name: 'Renk', value: foundColor });
  }

  // Beden tespiti
  const sizes = [
    'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl',
    'small', 'medium', 'large', 'xlarge', 'xxlarge',
    '32', '34', '36', '38', '40', '42', '44', '46', '48', '50',
  ];

  const foundSize = sizes.find(s => {
    const regex = new RegExp(`\\b${s}\\b`, 'i');
    return regex.test(title);
  });
  if (foundSize) {
    suggestions.push({ name: 'Beden', value: foundSize });
  }

  // Numara tespiti (ayakkabi)
  const numbers = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];
  const foundNumber = numbers.find(n => {
    const regex = new RegExp(`\\b${n}\\b`, 'i');
    return regex.test(title);
  });
  if (foundNumber && suggestions.length < 2) {
    suggestions.push({ name: 'Numara', value: foundNumber });
  }

  return suggestions;
}

/**
 * Feature flag kontrolu - bu motor kullanilabilir mi?
 */
export function isVariantEngineV2Enabled(): boolean {
  return env.VARIANT_ENGINE === 'v2';
}
