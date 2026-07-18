import { prisma } from '../db/prisma.ts';
import { AICore } from './aiCore/AICore.ts';

const CONFIDENCE_LABELS: Record<number, string> = {
  100: 'Kesin', 95: 'Çok Güvenli', 90: 'Güvenli',
  80: 'Kontrol Et', 70: 'Manuel İncele', 50: 'Önerme',
};

export function getConfidenceLabel(score: number): string {
  if (score >= 100) return 'Kesin';
  if (score >= 95) return 'Çok Güvenli';
  if (score >= 90) return 'Güvenli';
  if (score >= 80) return 'Kontrol Et';
  if (score >= 70) return 'Manuel İncele';
  return 'Önerme';
}

/**
 * Kategori eşleştirme için ana karar fonksiyonu.
 * 
 * Karar sırası:
 * 1. CategoryMapping tablosunu kontrol et (önceden öğrenilmiş eşleştirme)
 * 2. Bulunamadıysa AI Engine çalıştır (aiCore altyapısı ile)
 * 3. Confidence >= 95 → Otomatik eşleştir
 * 4. Confidence 80-94 → Öneri listesine ekle
 * 5. Confidence < 80 → Manuel incelemeye gönder
 * 6. AI başarısız olursa → keyword matching fallback
 */
export interface CategoryMatchResult {
  productId: string;
  productName: string;
  suggestedCategory: string | null;
  suggestedCategoryId: string | null;
  confidence: number;
  reason: string;
  source: 'mapping' | 'ai' | 'fallback' | 'none';
  status: 'auto_matched' | 'suggested' | 'manual_review' | 'failed';
}

export async function matchCategory(
  product: {
    id: string;
    title: string | null;
    xmlKey: string;
    supplierCategory: string | null;
    description: string | null;
    brandName: string | null;
    xmlSourceName: string | null;
  },
  systemCategories: Array<{ id: string; name: string; parentId: string | null }>
): Promise<CategoryMatchResult> {
  const productName = product.title || product.xmlKey;

  // ==================== ADIM 1: CategoryMapping kontrolü ====================
  if (product.supplierCategory) {
    const existingMapping = await prisma.categoryMapping.findFirst({
      where: { externalPath: product.supplierCategory },
      include: { category: { select: { id: true, name: true } } },
    });

    if (existingMapping?.category) {
      return {
        productId: product.id,
        productName,
        suggestedCategory: existingMapping.category.name,
        suggestedCategoryId: existingMapping.category.id,
        confidence: 98,
        reason: `Önceden öğrenilmiş eşleştirme: "${product.supplierCategory}" → "${existingMapping.category.name}"`,
        source: 'mapping',
        status: 'auto_matched',
      };
    }
  }

  // ==================== ADIM 2: AI Engine ====================
  try {
    const aiCore = new AICore();
    const aiResult = await aiCore.process('CategoryMatcher', {
      title: product.title || product.xmlKey,
      supplierCategory: product.supplierCategory || '',
      description: product.description || '',
      brandName: product.brandName || '',
      xmlSourceName: product.xmlSourceName || '',
      systemCategories: systemCategories.map(c => ({
        id: c.id,
        name: c.name,
        fullPath: buildCategoryPath(c.id, systemCategories),
      })),
    });

    if (aiResult.success && aiResult.data?.categoryId) {
      const confidence = Math.min(100, Math.max(0, aiResult.data.confidence || 0));
      const matchedCat = systemCategories.find(c => c.id === aiResult.data.categoryId);
      const matchName = matchedCat?.name || aiResult.data.categoryName || 'Bilinmeyen';

      // ADIM 3: Confidence >= 95 → Otomatik eşleştir
      if (confidence >= 95) {
        return {
          productId: product.id,
          productName,
          suggestedCategory: matchName,
          suggestedCategoryId: aiResult.data.categoryId,
          confidence,
          reason: aiResult.data.reasoning || `AI yüksek güvenle "${matchName}" kategorisini önerdi`,
          source: 'ai',
          status: 'auto_matched',
        };
      }

      // ADIM 4: Confidence 80-94 → Öneri listesine ekle
      if (confidence >= 80) {
        return {
          productId: product.id,
          productName,
          suggestedCategory: matchName,
          suggestedCategoryId: aiResult.data.categoryId,
          confidence,
          reason: aiResult.data.reasoning || `AI "${matchName}" kategorisini öneriyor`,
          source: 'ai',
          status: 'suggested',
        };
      }

      // ADIM 5: Confidence < 80 → Manuel incelemeye gönder
      return {
        productId: product.id,
        productName,
        suggestedCategory: matchName,
        suggestedCategoryId: aiResult.data.categoryId,
        confidence,
        reason: aiResult.data.reasoning || `AI düşük güvenle "${matchName}" önerdi, manuel inceleme gerekli`,
        source: 'ai',
        status: 'manual_review',
      };
    }
  } catch (err) {
    console.warn('[CategoryMatch] AI engine failed, using fallback:', err);
  }

  // ==================== ADIM 6: Fallback — keyword matching ====================
  return fallbackKeywordMatch(product, systemCategories);
}

/**
 * Fallback: Eski keyword matching mantığı (AI başarısız olursa)
 */
async function fallbackKeywordMatch(
  product: {
    id: string;
    title: string | null;
    xmlKey: string;
    supplierCategory: string | null;
    description: string | null;
    brandName: string | null;
  },
  systemCategories: Array<{ id: string; name: string; parentId: string | null }>
): Promise<CategoryMatchResult> {
  const productName = product.title || product.xmlKey;
  const searchText = [
    product.title || '',
    product.xmlKey || '',
    product.supplierCategory || '',
    product.description || '',
    product.brandName || '',
  ].join(' ').toLowerCase();

  // Kategori adı index'i
  const catIndex = new Map<string, { id: string; name: string }>();
  for (const cat of systemCategories) {
    const normalized = cat.name.toLowerCase().trim();
    catIndex.set(normalized, { id: cat.id, name: cat.name });
    const words = normalized.split(/[\s>\/\\,]+/).filter(Boolean);
    for (const word of words) {
      if (word.length > 2 && !catIndex.has(word)) {
        catIndex.set(word, { id: cat.id, name: cat.name });
      }
    }
  }

  // 1. XML kategorisi ile tam eşleşme
  if (product.supplierCategory) {
    const supplierNorm = product.supplierCategory.toLowerCase().trim();
    const directMatch = catIndex.get(supplierNorm);
    if (directMatch) {
      return {
        productId: product.id,
        productName,
        suggestedCategory: directMatch.name,
        suggestedCategoryId: directMatch.id,
        confidence: 90,
        reason: `XML kategorisi "${product.supplierCategory}" ile keyword eşleşmesi`,
        source: 'fallback',
        status: 'suggested',
      };
    }
  }

  // 2. Keyword bazlı eşleşme
  const searchWords = searchText.split(/[\s,;:!?.\-()\[\]{}<>\/\\]+/).filter(w => w.length > 2);
  const uniqueWords = [...new Set(searchWords)];

  let bestMatch: { id: string; name: string; score: number } | null = null;
  for (const word of uniqueWords) {
    const match = catIndex.get(word);
    if (match) {
      const score = Math.min(85, Math.round((word.length / Math.max(searchText.length, 1)) * 100 + 40));
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { id: match.id, name: match.name, score };
      }
    }
  }

  if (bestMatch) {
    return {
      productId: product.id,
      productName,
      suggestedCategory: bestMatch.name,
      suggestedCategoryId: bestMatch.id,
      confidence: bestMatch.score,
      reason: `"${searchWords[0]}" anahtar kelimesi "${bestMatch.name}" ile eşleşti (fallback)`,
      source: 'fallback',
      status: bestMatch.score >= 80 ? 'suggested' : 'manual_review',
    };
  }

  return {
    productId: product.id,
    productName,
    suggestedCategory: null,
    suggestedCategoryId: null,
    confidence: 0,
    reason: 'Hiçbir eşleşme bulunamadı',
    source: 'none',
    status: 'failed',
  };
}

/**
 * Kategori tam yolunu oluştur (örn: "Elektronik > Bilgisayar > Laptop")
 */
function buildCategoryPath(categoryId: string, allCategories: Array<{ id: string; name: string; parentId: string | null }>): string {
  const catMap = new Map(allCategories.map(c => [c.id, c]));
  const parts: string[] = [];
  let current = catMap.get(categoryId);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? catMap.get(current.parentId) : undefined;
  }
  return parts.join(' > ');
}

// ==================== ESKİ FONKSİYONLAR (KORUNUYOR) ====================

export async function aiSuggest(module: string, productId: string): Promise<{
  suggestions: Array<{ value: string; confidence: number; label: string; reason: string }>;
}> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, category: true },
  });
  if (!product) throw new Error('Product not found');

  const suggestions: Array<{ value: string; confidence: number; label: string; reason: string }> = [];

  switch (module) {
    case 'CATEGORY': {
      if (product.supplierCategory) {
        const knowledge = await prisma.aIKnowledge.findMany({
          where: { module: 'CATEGORY', input: { contains: product.supplierCategory.split('>').pop()?.trim() || '' } },
          orderBy: { useCount: 'desc' },
          take: 3,
        });
        for (const k of knowledge) {
          suggestions.push({
            value: k.output,
            confidence: Math.round(k.confidence),
            label: getConfidenceLabel(k.confidence),
            reason: `${k.useCount} kez kullanıldı, ${k.acceptCount} kabul, ${k.rejectCount} red`,
          });
        }
        const catName = product.supplierCategory.split('>').pop()?.trim() || '';
        suggestions.push({ value: catName, confidence: 70, label: 'Manuel İncele', reason: 'XML kategorisinden türetildi' });
      }
      break;
    }
    case 'BRAND': {
      if (product.brand?.name) {
        const knowledge = await prisma.aIKnowledge.findMany({
          where: { module: 'BRAND', input: product.brand.name },
          orderBy: { useCount: 'desc' },
          take: 3,
        });
        for (const k of knowledge) {
          suggestions.push({
            value: k.output,
            confidence: Math.round(k.confidence),
            label: getConfidenceLabel(k.confidence),
            reason: `${k.useCount} kez kullanıldı, ${k.acceptCount} kabul`,
          });
        }
        suggestions.push({ value: product.brand.name, confidence: 85, label: 'Güvenli', reason: 'XML markası doğrudan kullanılabilir' });
      }
      break;
    }
    case 'TITLE': {
      const brandName = product.brand?.name || '';
      const template = await prisma.titleTemplate.findFirst({ where: { isActive: true }, orderBy: { priority: 'desc' } });
      const tpl = template?.template || '{BRAND}® {PRODUCT_NAME}';
      const generated = tpl.replace('{BRAND}', brandName).replace('{PRODUCT_NAME}', product.originalTitle || product.title || '');
      suggestions.push({ value: generated, confidence: 85, label: 'Güvenli', reason: 'Şablondan oluşturuldu' });
      break;
    }
    default:
      suggestions.push({ value: 'Öneri bulunamadı', confidence: 0, label: 'Önerme', reason: 'Modül için veri yok' });
  }

  return { suggestions: suggestions.sort((a, b) => b.confidence - a.confidence) };
}

export async function aiLearn(module: string, input: string, output: string, accepted: boolean): Promise<void> {
  const existing = await prisma.aIKnowledge.findUnique({ where: { module_input_output: { module, input, output } } });
  if (existing) {
    await prisma.aIKnowledge.update({
      where: { id: existing.id },
      data: {
        useCount: { increment: 1 },
        acceptCount: accepted ? { increment: 1 } : undefined,
        rejectCount: !accepted ? { increment: 1 } : undefined,
        confidence: Math.min(100, existing.confidence + (accepted ? 2 : -5)),
        lastUsedAt: new Date(),
      },
    });
  } else {
    await prisma.aIKnowledge.create({
      data: { module, input, output, confidence: accepted ? 80 : 50, useCount: 1, acceptCount: accepted ? 1 : 0, rejectCount: accepted ? 0 : 1 },
    });
  }
}

// ==================== MARKA EŞLEŞTİRME ====================

export interface BrandMatchResult {
  productId: string;
  productName: string;
  suggestedBrand: string | null;
  suggestedBrandId: string | null;
  confidence: number;
  reason: string;
  source: 'mapping' | 'ai' | 'fallback' | 'none';
  status: 'auto_matched' | 'suggested' | 'manual_review' | 'failed';
}

/**
 * Marka eşleştirme için ana karar fonksiyonu.
 *
 * Karar sırası (Kategori matchCategory ile aynı):
 * 1. BrandMapping tablosunu kontrol et (önceden öğrenilmiş eşleştirme)
 * 2. Bulunamadıysa AI Engine çalıştır (aiCore)
 * 3. Confidence >= 95 → Otomatik eşleştir
 * 4. Confidence 80-94 → Öneri listesine ekle
 * 5. Confidence < 80 → Manuel incelemeye gönder
 * 6. AI başarısız olursa → keyword matching fallback
 */
export async function matchBrand(
  product: {
    id: string;
    title: string | null;
    xmlKey: string;
    xmlBrandName: string | null;
    description: string | null;
    barcode: string | null;
    supplierName: string | null;
    currentBrandId: string | null;
  },
  systemBrands: Array<{ id: string; name: string }>
): Promise<BrandMatchResult> {
  const productName = product.title || product.xmlKey;
  const brandName = product.xmlBrandName || '';

  // ==================== ADIM 1: BrandMapping kontrolü ====================
  if (brandName) {
    const existingMapping = await prisma.brandMapping.findUnique({
      where: { xmlBrandName: brandName },
    });

    if (existingMapping) {
      const matchedBrand = systemBrands.find(b => b.id === existingMapping.dgBrandId);
      if (matchedBrand) {
        return {
          productId: product.id,
          productName,
          suggestedBrand: matchedBrand.name,
          suggestedBrandId: matchedBrand.id,
          confidence: 98,
          reason: `Önceden öğrenilmiş eşleştirme: "${brandName}" → "${matchedBrand.name}"`,
          source: 'mapping',
          status: 'auto_matched',
        };
      }
    }
  }

  // ==================== ADIM 2: AI Engine ====================
  try {
    const aiCore = new AICore();
    const aiResult = await aiCore.process('BrandMatcher', {
      title: product.title || product.xmlKey,
      xmlBrandName: brandName,
      description: product.description || '',
      barcode: product.barcode || '',
      supplierName: product.supplierName || '',
      currentBrandId: product.currentBrandId,
      systemBrands: systemBrands.map(b => ({ id: b.id, name: b.name })),
    });

    if (aiResult.success && aiResult.data?.brandId) {
      const confidence = Math.min(100, Math.max(0, aiResult.data.confidence || 0));
      const matchedBrand = systemBrands.find(b => b.id === aiResult.data.brandId);
      const matchName = matchedBrand?.name || aiResult.data.brandName || 'Bilinmeyen';

      // ADIM 3: Confidence >= 95 → Otomatik eşleştir
      if (confidence >= 95) {
        return {
          productId: product.id,
          productName,
          suggestedBrand: matchName,
          suggestedBrandId: aiResult.data.brandId,
          confidence,
          reason: aiResult.data.reasoning || `AI yüksek güvenle "${matchName}" markasını önerdi`,
          source: 'ai',
          status: 'auto_matched',
        };
      }

      // ADIM 4: Confidence 80-94 → Öneri listesine ekle
      if (confidence >= 80) {
        return {
          productId: product.id,
          productName,
          suggestedBrand: matchName,
          suggestedBrandId: aiResult.data.brandId,
          confidence,
          reason: aiResult.data.reasoning || `AI "${matchName}" markasını öneriyor`,
          source: 'ai',
          status: 'suggested',
        };
      }

      // ADIM 5: Confidence < 80 → Manuel incelemeye gönder
      return {
        productId: product.id,
        productName,
        suggestedBrand: matchName,
        suggestedBrandId: aiResult.data.brandId,
        confidence,
        reason: aiResult.data.reasoning || `AI düşük güvenle "${matchName}" önerdi, manuel inceleme gerekli`,
        source: 'ai',
        status: 'manual_review',
      };
    }
  } catch (err) {
    console.warn('[BrandMatch] AI engine failed, using fallback:', err);
  }

  // ==================== ADIM 6: Fallback — keyword matching ====================
  return fallbackBrandMatch(product, systemBrands);
}

/**
 * Fallback: Marka keyword matching (AI başarısız olursa)
 */
async function fallbackBrandMatch(
  product: {
    id: string;
    title: string | null;
    xmlKey: string;
    xmlBrandName: string | null;
    description: string | null;
  },
  systemBrands: Array<{ id: string; name: string }>
): Promise<BrandMatchResult> {
  const productName = product.title || product.xmlKey;
  const searchText = [
    product.title || '',
    product.xmlKey || '',
    product.xmlBrandName || '',
    product.description || '',
  ].join(' ').toLowerCase();

  const brandName = (product.xmlBrandName || '').toLowerCase().trim();
  if (!brandName) {
    return {
      productId: product.id,
      productName,
      suggestedBrand: null,
      suggestedBrandId: null,
      confidence: 0,
      reason: 'XML marka bilgisi yok',
      source: 'none',
      status: 'failed',
    };
  }

  let bestMatch: { id: string; name: string; score: number } | null = null;

  for (const sb of systemBrands) {
    const sysName = sb.name.toLowerCase().trim();
    let score = 0;

    // Tam eşleşme
    if (brandName === sysName) {
      score = 95;
    }
    // Normalize edilmiş eşleşme (Türkçe karakter)
    else if (brandName.replace(/[ığüşöçİĞÜŞÖÇ]/g, '') === sysName.replace(/[ığüşöçİĞÜŞÖÇ]/g, '')) {
      score = 90;
    }
    // İçerme kontrolü
    else if (brandName.includes(sysName) || sysName.includes(brandName)) {
      score = 85;
    }
    // Levenshtein mesafesi
    else {
      const dist = levenshteinDistance(brandName, sysName);
      const maxLen = Math.max(brandName.length, sysName.length);
      if (maxLen > 0) score = Math.max(0, Math.round((1 - dist / maxLen) * 100));
    }

    if (score > 60 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: sb.id, name: sb.name, score };
    }
  }

  // Ürün başlığında marka ara (eğer hiç eşleşme yoksa)
  if (!bestMatch && product.title) {
    for (const sb of systemBrands) {
      if (product.title.toLowerCase().includes(sb.name.toLowerCase())) {
        if (!bestMatch || 75 > bestMatch.score) {
          bestMatch = { id: sb.id, name: sb.name, score: 75 };
        }
      }
    }
  }

  if (bestMatch) {
    return {
      productId: product.id,
      productName,
      suggestedBrand: bestMatch.name,
      suggestedBrandId: bestMatch.id,
      confidence: bestMatch.score,
      reason: `Fallback eşleşmesi: "${bestMatch.name}" (skor: ${bestMatch.score})`,
      source: 'fallback',
      status: bestMatch.score >= 80 ? 'suggested' : 'manual_review',
    };
  }

  return {
    productId: product.id,
    productName,
    suggestedBrand: null,
    suggestedBrandId: null,
    confidence: 0,
    reason: 'Hiçbir marka eşleşmesi bulunamadı',
    source: 'none',
    status: 'failed',
  };
}

/**
 * Levenshtein mesafesi (brands.ts'deki yardımcı fonksiyonla aynı)
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
