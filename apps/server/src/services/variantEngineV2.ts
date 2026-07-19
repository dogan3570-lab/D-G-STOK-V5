// ==================== VARYANT MOTORU V2.0 - AKILLI DOĞRULAMA VE İSTİSNA YÖNETİMİ ====================
// DG STOK V5.0
// Amaç: Yalnızca gerçek pazaryeri sorunu oluşturacak ürünleri tespit et
// Parent SKU eksik olması tek başına hata nedeni DEĞİLDİR.
// ================================================================================================
import { prisma } from '../db/prisma.ts';

// ==================== TYPES ====================

export interface VariantAnalysisResult {
  productId: string;
  confidence: number;
  source: 'XML_PARENT' | 'AI_MATCH' | 'AUTO_CREATED' | 'NO_VARIANT_NEEDED' | 'MANUAL';
  status: 'AUTO_ACCEPTED' | 'AUTO_SUGGEST' | 'MANUAL_REVIEW' | 'ERROR';
  reason: string | null;
  parentSku: string | null;
  groupId: string | null;
  xmlHasParent: boolean;
  phase: number; // Hangi aşamada karar verildi
  checks: Record<string, boolean>;
  errors: string[];
  warnings: string[];
}

export interface AnalysisStats {
  totalProducts: number;
  xmlVariant: number;        // XML'den doğru gelen
  autoCreated: number;       // DG STOK otomatik oluşturdu
  autoSuggest: number;       // Otomatik onay bekleyen (80-94)
  manualReview: number;      // Manuel inceleme (0-79)
  errors: number;            // Kesin hatalı
}

export interface VariantScreenProduct {
  id: string;
  sku: string | null;
  xmlKey: string;
  title: string | null;
  barcode: string | null;
  brandName: string | null;
  categoryName: string | null;
  xmlSourceName: string | null;
  confidence: number;
  status: string;
  reason: string | null;
  suggestedAction: string | null;
  hasColor: boolean;
  hasSize: boolean;
  hasNumber: boolean;
  parentSku: string | null;
  groupId: string | null;
}

interface ProductWithRelations {
  id: string;
  sku: string | null;
  xmlKey: string;
  title: string | null;
  barcode: string | null;
  brandId: string | null;
  categoryId: string | null;
  supplierCategory: string | null;
  purchasePrice: number | null;
  salePrice: number | null;
  stock: number;
  status: string;
  description: string | null;
  brand?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string } | null;
  variants: Array<{ id: string; name: string; value: string }>;
}

// ==================== KONSTANTLAR ====================

const XML_VARIANT_FIELDS = [
  'parentsku', 'parent_sku', 'parent sku', 'parentid', 'parent_id',
  'variantgroup', 'variant_group', 'groupid', 'group_id',
  'itemgroupid', 'item_group_id', 'variationtheme', 'variation_theme',
];

const COLOR_KEYWORDS = [
  'siyah', 'beyaz', 'kırmızı', 'mavi', 'yeşil', 'sarı', 'mor', 'turuncu',
  'pembe', 'gri', 'lacivert', 'bordo', 'bej', 'kahverengi', 'krem', 'füme',
  'metalik', 'altın', 'gümüş', 'turkuaz', 'black', 'white', 'red', 'blue',
  'green', 'yellow', 'purple', 'pink', 'gray', 'grey', 'brown', 'beige',
  'navy', 'burgundy', 'silver', 'gold', 'orange',
];

const SIZE_KEYWORDS = [
  'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl',
  'xxxl', 'small', 'medium', 'large', 'xlarge', 'xxlarge',
  '32', '34', '36', '38', '40', '42', '44', '46', '48', '50',
  '52', '54', '56', '58', '60',
];

const NUMBER_KEYWORDS = [
  '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45',
  '46', '47', '48', '49', '50',
];

// ==================== VARYANT GEREKTİRMEYEN KATEGORİLER ====================
// Bu kategorilerdeki ürünler varyantsız yayınlanabilir
const NO_VARIANT_CATEGORIES = [
  'kupa', 'bardak', 'fincan', 'tabak', 'kase', 'çanak',
  'kemer', 'masa', 'sandalye', 'sepet',
  'defter', 'kitap', 'kalem', 'silgi', 'dosya',
  'yastık', 'battaniye', 'havlu', 'bornoz',
  'çorap', 'eldiven', 'bere', 'şapka', 'atkı',
  'çanta', 'valiz', 'sırt çantası',
  'şemsiye', 'anahtarlık', 'cüzdan', 'kartlık',
  'bebek battaniyesi', 'emzik', 'biberon',
  'mum', 'vazo', 'çerçeve', 'süs eşyası',
  'mat', 'minders', 'kilim', 'halı',
  'vitamin', 'gıda takviyesi',
  'oyuncak ayı', 'peluş', 'yapboz',
];

// ==================== PAZARYERİ KURALLARI ====================
// Hangi pazaryeri hangi varyant alanlarını zorunlu kılar
const MARKETPLACE_RULES: Record<string, { requiredAttrs: string[]; optionalAttrs: string[] }> = {
  trendyol: { requiredAttrs: ['Renk', 'Beden'], optionalAttrs: ['Numara', 'Cinsiyet', 'Materyal', 'Desen', 'Kalıp', 'Kapasite', 'Hacim', 'Model'] },
  hepsiburada: { requiredAttrs: ['Renk'], optionalAttrs: ['Beden', 'Numara', 'Cinsiyet'] },
  amazon: { requiredAttrs: ['Renk', 'Beden'], optionalAttrs: ['Numara', 'Materyal'] },
  n11: { requiredAttrs: ['Renk'], optionalAttrs: ['Beden', 'Numara'] },
  pazarama: { requiredAttrs: ['Renk'], optionalAttrs: ['Beden', 'Numara'] },
};

// ==================== HELPER'LAR ====================

function titleSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 85;

  // Token bazlı karşılaştırma
  const t1 = s1.split(/[\s,]+/).filter(Boolean);
  const t2 = s2.split(/[\s,]+/).filter(Boolean);
  const common = t1.filter(t => t2.includes(t)).length;
  if (common > 0) return Math.round((common / Math.max(t1.length, t2.length)) * 80);

  return 0;
}

function extractColors(title: string): string[] {
  const lower = title.toLowerCase();
  return COLOR_KEYWORDS.filter(c => lower.includes(c));
}

function extractSizes(title: string): string[] {
  const lower = title.toLowerCase();
  return SIZE_KEYWORDS.filter(s => {
    const regex = new RegExp(`\\b${s}\\b`, 'i');
    return regex.test(lower);
  });
}

function extractNumbers(title: string): string[] {
  const lower = title.toLowerCase();
  return NUMBER_KEYWORDS.filter(n => {
    const regex = new RegExp(`\\b${n}\\b`, 'i');
    return regex.test(lower);
  });
}

function skuPrefix(sku: string): string {
  return sku.replace(/[0-9_-]+$/, '').replace(/[\s_-]+$/, '');
}

function categoryNeedsVariant(categoryName: string | null): boolean {
  if (!categoryName) return false; // Bilinmiyorsa varyant gerekmez
  const lower = categoryName.toLowerCase();
  for (const noVariant of NO_VARIANT_CATEGORIES) {
    if (lower.includes(noVariant)) return false;
  }
  return true;
}

function generateParentSku(product: ProductWithRelations): string {
  const base = product.sku ? skuPrefix(product.sku) : (product.xmlKey.replace(/[0-9-]+$/, ''));
  return `${base}_GROUP`;
}

function generateGroupId(): string {
  return `DG_GRP_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ==================== AŞAMA 1: XML VARYANT KONTROLÜ ====================
// Kontrol: Parent SKU, Parent ID, Group ID, Variation Theme, Color, Size, Number, Attributes, ItemGroupId
// Eğer varyant yapısı eksiksiz ise → Ürün otomatik kabul edilir, varyant ekranına gelmez.
export async function analyzeXmlVariant(
  product: ProductWithRelations,
  xmlFields: Record<string, string>
): Promise<{
  hasParent: boolean;
  score: number;
  parentSku: string | null;
  details: Record<string, boolean>;
}> {
  const details: Record<string, boolean> = {
    hasParentSku: false,
    hasParentId: false,
    hasGroupId: false,
    hasItemGroupId: false,
    hasVariationTheme: false,
    hasColor: false,
    hasSize: false,
    hasNumber: false,
    hasMultipleVariants: false,
  };

  // XML alanlarında parent SKU ve grup bilgisi kontrolü
  const lowerFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(xmlFields)) {
    lowerFields[k.toLowerCase().trim()] = v;
  }

  // Parent SKU / ID / Group ID kontrolü
  for (const pattern of XML_VARIANT_FIELDS) {
    if (lowerFields[pattern]) {
      if (pattern.includes('parent')) {
        details.hasParentSku = true;
      }
      if (pattern.includes('group')) {
        details.hasGroupId = true;
      }
      if (pattern.includes('itemgroup')) {
        details.hasItemGroupId = true;
      }
    }
  }

  // Variation Theme kontrolü
  if (lowerFields['variation_theme'] || lowerFields['variationtheme'] || lowerFields['varianstheme']) {
    details.hasVariationTheme = true;
  }

  // Mevcut varyantlardan parent tespiti
  if (product.variants && product.variants.length > 0) {
    const variantNames = product.variants.map(v => v.name.toLowerCase());
    if (variantNames.includes('renk') || variantNames.includes('color')) details.hasColor = true;
    if (variantNames.includes('beden') || variantNames.includes('size')) details.hasSize = true;
    if (variantNames.includes('numara')) details.hasNumber = true;
  }

  // Ürün adından renk/beden/numara tespiti
  if (product.title) {
    const colors = extractColors(product.title);
    if (colors.length > 0) details.hasColor = true;
    const sizes = extractSizes(product.title);
    if (sizes.length > 0) details.hasSize = true;
    const numbers = extractNumbers(product.title);
    if (numbers.length > 0) details.hasNumber = true;
  }

  // Puan hesapla - Anahtar alanlar daha yüksek puan alır
  let score = 0;
  if (details.hasParentSku || details.hasItemGroupId) score += 50; // Parent bilgisi varsa yüksek puan
  if (details.hasGroupId) score += 20;
  if (details.hasVariationTheme) score += 15;
  if (details.hasColor) score += 5;
  if (details.hasSize) score += 5;
  if (details.hasNumber) score += 5;

  return {
    hasParent: details.hasParentSku || details.hasItemGroupId,
    score: Math.min(100, score),
    parentSku: lowerFields['parentsku'] || lowerFields['parent_sku'] || lowerFields['parent sku'] || null,
    details,
  };
}

// ==================== AŞAMA 2: VARYANT GEREKLİLİK ANALİZİ ====================
// "Bu ürün seçilen pazaryerinde gerçekten varyantlı olmak zorunda mı?"
// Kategori, ürün tipi, pazaryeri kuralları ve XML attribute incelenir.
// Örn: Kupa, Kemer, Masa, Tabak gibi tek ürün satılan ürünler varyantsız yayınlanabiliyorsa kabul edilir.
function analyzeVariantRequirement(
  product: ProductWithRelations,
  marketplaceKey: string = 'trendyol'
): {
  needsVariant: boolean;
  reason: string | null;
  score: number;
} {
  // 1. Kategori kontrolü
  const categoryName = product.category?.name || product.supplierCategory || null;
  if (categoryName) {
    const needsVariant = categoryNeedsVariant(categoryName);
    if (!needsVariant) {
      return {
        needsVariant: false,
        reason: `${categoryName} kategorisi varyant gerektirmez`,
        score: 100,
      };
    }
  }

  // 2. Pazaryeri kuralları kontrolü
  const rules = MARKETPLACE_RULES[marketplaceKey] || MARKETPLACE_RULES.trendyol;
  
  // 3. Varyant attribute'leri var mı kontrol et
  const hasAnyVariant = (product.variants && product.variants.length > 0);
  const hasColorInTitle = product.title ? extractColors(product.title).length > 0 : false;
  const hasSizeInTitle = product.title ? extractSizes(product.title).length > 0 : false;
  const hasNumberInTitle = product.title ? extractNumbers(product.title).length > 0 : false;

  // Üründe hiç varyant yoksa ve ürün adında da renk/beden/numara yoksa
  // ve kategori varyant gerektirmiyorsa veya kategori bilinmiyorsa → varyant gerekmez
  if (!hasAnyVariant && !hasColorInTitle && !hasSizeInTitle && !hasNumberInTitle) {
    // Kategori bilinmiyor veya varyant gerektirmiyor
    if (!categoryName || !categoryNeedsVariant(categoryName)) {
      return {
        needsVariant: false,
        reason: categoryName
          ? `${categoryName} varyantsız yayınlanabilir`
          : 'Kategori bilinmiyor, ürün varyantsız kabul edildi',
        score: 100,
      };
    }
  }

  return {
    needsVariant: true,
    reason: null,
    score: 0,
  };
}

// ==================== AŞAMA 3: KATEGORİ ANALİZİ ====================
// Ürünün kategorisine göre hangi varyant alanlarının geçerli olduğunu belirler
function analyzeCategory(product: ProductWithRelations): {
  score: number;
  details: Record<string, number>;
  recommendedAttrs: string[];
} {
  const categoryName = product.category?.name || product.supplierCategory || '';
  const lowerCat = categoryName.toLowerCase();
  const details: Record<string, number> = {};
  const recommendedAttrs: string[] = [];

  let score = 50; // Temel puan

  // Kategori bazında varyant alanı önerileri
  if (lowerCat.includes('ayakkabı') || lowerCat.includes('shoe')) {
    recommendedAttrs.push('Renk', 'Numara');
    score += 20;
  } else if (lowerCat.includes('giyim') || lowerCat.includes('elbise') || 
             lowerCat.includes('pantolon') || lowerCat.includes('t-shirt') ||
             lowerCat.includes('gömlek') || lowerCat.includes('mont')) {
    recommendedAttrs.push('Renk', 'Beden');
    score += 20;
  } else if (lowerCat.includes('elektronik') || lowerCat.includes('telefon') ||
             lowerCat.includes('bilgisayar')) {
    recommendedAttrs.push('Renk', 'Kapasite');
    score += 15;
  } else if (lowerCat.includes('aksesuar') || lowerCat.includes('takı') ||
             lowerCat.includes('saat')) {
    recommendedAttrs.push('Renk', 'Model');
    score += 10;
  } else if (lowerCat.includes('kozmetik') || lowerCat.includes('parfüm')) {
    recommendedAttrs.push('Renk');
    score += 10;
  }

  // Kategoriden renk/beden çıkarımı
  if (recommendedAttrs.includes('Renk')) details.categoryHasColor = 20;
  else details.categoryHasColor = 0;
  
  if (recommendedAttrs.includes('Beden') || recommendedAttrs.includes('Numara')) {
    details.categoryHasSize = 15;
  } else {
    details.categoryHasSize = 0;
  }

  return { score: Math.min(100, score), details, recommendedAttrs };
}

// ==================== AŞAMA 4: ATTRIBUTE ANALİZİ ====================
// Mevcut attribute'leri pazaryeri gereksinimleriyle karşılaştırır
function analyzeAttributes(
  product: ProductWithRelations,
  marketplaceKey: string = 'trendyol'
): {
  score: number;
  missingRequired: string[];
  presentAttrs: string[];
  details: Record<string, number>;
} {
  const rules = MARKETPLACE_RULES[marketplaceKey] || MARKETPLACE_RULES.trendyol;
  const details: Record<string, number> = {};
  
  // Mevcut attribute'ler
  const variantNames = (product.variants || []).map(v => v.name);
  const presentAttrs = [...variantNames];
  
  // Ürün adından tespit edilen attribute'ler
  if (product.title) {
    if (extractColors(product.title).length > 0 && !presentAttrs.includes('Renk')) {
      presentAttrs.push('Renk');
    }
    if (extractSizes(product.title).length > 0 && !presentAttrs.includes('Beden')) {
      presentAttrs.push('Beden');
    }
    if (extractNumbers(product.title).length > 0 && !presentAttrs.includes('Numara')) {
      presentAttrs.push('Numara');
    }
  }

  // Eksik zorunlu attribute'ler
  const missingRequired = rules.requiredAttrs.filter(
    attr => !presentAttrs.some(p => p.toLowerCase() === attr.toLowerCase())
  );

  let score = 100;
  if (missingRequired.length > 0) {
    score -= missingRequired.length * 20; // Her eksik zorunlu attr için -20
  }

  details.hasRequiredAttrs = missingRequired.length === 0 ? 30 : 0;
  details.hasOptionalAttrs = rules.optionalAttrs.some(
    oa => presentAttrs.some(pa => pa.toLowerCase() === oa.toLowerCase())
  ) ? 10 : 0;

  return {
    score: Math.max(0, score),
    missingRequired,
    presentAttrs,
    details,
  };
}

// ==================== AŞAMA 5: AKILLI VARYANT ANALİZİ ====================
// XML eksik olsa bile ürün adı, marka, kategori, renk, beden, numara,
// desen, model, materyal, SKU yapısı, barkod analiz edilir.
// DG STOK güvenle aynı ürün ailesi olduğuna karar verirse otomatik varyant oluşturur.
export async function smartAnalyze(
  product: ProductWithRelations,
  allProducts: ProductWithRelations[]
): Promise<{
  score: number;
  parentSku: string | null;
  details: Record<string, number>;
  reason: string | null;
  matchedProduct: { id: string; title: string; sku: string } | null;
}> {
  const details: Record<string, number> = {};
  let totalScore = 0;
  let bestMatch: { product: ProductWithRelations; score: number } | null = null;

  if (!product.title) {
    return { score: 0, parentSku: null, details: { noTitle: 0 }, reason: 'Ürün adı yok', matchedProduct: null };
  }

  // Adayları bul - aynı marka veya aynı kategorideki ürünler
  const candidates = allProducts.filter(p =>
    p.id !== product.id &&
    p.title &&
    (p.brandId === product.brandId || p.categoryId === product.categoryId)
  );

  if (candidates.length === 0) {
    return { score: 0, parentSku: null, details: {}, reason: 'Benzer ürün bulunamadı', matchedProduct: null };
  }

  // Çoklu kriter bazlı eşleştirme
  for (const candidate of candidates) {
    if (!candidate.title) continue;
    let matchScore = 0;
    const matchDetails: string[] = [];

    // 1. Ürün adı benzerliği (max 35 puan)
    const sim = titleSimilarity(product.title, candidate.title);
    matchScore += sim * 0.35;
    if (sim > 50) matchDetails.push('title');

    // 2. Marka eşleşmesi (max 20 puan)
    if (product.brandId && product.brandId === candidate.brandId) {
      matchScore += 20;
      matchDetails.push('brand');
    }

    // 3. Kategori eşleşmesi (max 15 puan)
    if (product.categoryId && product.categoryId === candidate.categoryId) {
      matchScore += 15;
      matchDetails.push('category');
    }

    // 4. SKU yapısı benzerliği (max 15 puan)
    if (product.sku && candidate.sku) {
      const prefix1 = skuPrefix(product.sku);
      const prefix2 = skuPrefix(candidate.sku);
      if (prefix1 === prefix2) {
        matchScore += 15;
        matchDetails.push('sku_prefix');
      } else if (prefix1.includes(prefix2) || prefix2.includes(prefix1)) {
        matchScore += 8;
        matchDetails.push('sku_partial');
      }
    }

    // 5. Barkod benzerliği (max 5 puan)
    if (product.barcode && candidate.barcode) {
      if (product.barcode.substring(0, 6) === candidate.barcode.substring(0, 6)) {
        matchScore += 5;
        matchDetails.push('barcode_prefix');
      }
    }

    if (matchScore > (bestMatch?.score || 0)) {
      bestMatch = { product: candidate, score: Math.round(matchScore) };
    }
  }

  if (!bestMatch || bestMatch.score < 20) {
    return {
      score: bestMatch?.score || 0,
      parentSku: null,
      details,
      reason: bestMatch?.score ? 'Benzerlik çok düşük' : 'Benzer ürün bulunamadı',
      matchedProduct: null,
    };
  }

  totalScore = bestMatch.score;

  // Renk tespiti bonusu (max 10)
  if (product.title) {
    const colors = extractColors(product.title);
    if (colors.length > 0) totalScore += Math.min(10, colors.length * 5);
  }

  // Numara/beden tespiti bonusu (max 10)
  if (product.title) {
    const sizes = extractSizes(product.title);
    const numbers = extractNumbers(product.title);
    if (sizes.length > 0 || numbers.length > 0) totalScore += 10;
  }

  details.titleSimilarity = bestMatch.score;
  details.brandBonus = product.brandId && product.brandId === bestMatch.product.brandId ? 20 : 0;
  details.categoryBonus = product.categoryId && product.categoryId === bestMatch.product.categoryId ? 15 : 0;
  details.skuBonus = (product.sku && bestMatch.product.sku && skuPrefix(product.sku) === skuPrefix(bestMatch.product.sku)) ? 15 : 0;

  const matchedProduct = {
    id: bestMatch.product.id,
    title: bestMatch.product.title || bestMatch.product.xmlKey,
    sku: bestMatch.product.sku || bestMatch.product.xmlKey,
  };

  const parentSku = bestMatch.product.sku || bestMatch.product.xmlKey;

  return {
    score: Math.min(100, totalScore),
    parentSku,
    details,
    reason: totalScore >= 80 ? null : totalScore >= 50 ? 'Benzerlik orta seviye' : 'Benzerlik düşük',
    matchedProduct,
  };
}

// ==================== AŞAMA 6: GÜVEN SKORU HESABI ====================
function calculateConfidenceScore(phases: {
  xmlScore: number;
  requirementScore: number;
  categoryScore: number;
  attributeScore: number;
  smartScore: number;
}): number {
  // Aşamaların ağırlıkları
  const weights = {
    xmlScore: 0.30,          // %30 - XML varyant bilgisi
    requirementScore: 0.20,  // %20 - Varyant gereklilik analizi
    categoryScore: 0.15,     // %15 - Kategori analizi
    attributeScore: 0.20,    // %20 - Attribute analizi
    smartScore: 0.15,        // %15 - Akıllı varyant analizi
  };

  let totalScore = 0;
  totalScore += phases.xmlScore * weights.xmlScore;
  totalScore += phases.requirementScore * weights.requirementScore;
  totalScore += phases.categoryScore * weights.categoryScore;
  totalScore += phases.attributeScore * weights.attributeScore;
  totalScore += phases.smartScore * weights.smartScore;

  return Math.round(Math.min(100, Math.max(0, totalScore)));
}

// ==================== AŞAMA 7: ÇAKIŞMA KONTROLÜ ====================
export async function detectConflicts(
  product: ProductWithRelations,
  allProducts: ProductWithRelations[]
): Promise<{ errors: string[]; warnings: string[]; checks: Record<string, boolean> }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: Record<string, boolean> = {};

  // Aynı barkod farklı ürünlerde
  if (product.barcode) {
    const sameBarcode = allProducts.find(p => p.id !== product.id && p.barcode === product.barcode);
    if (sameBarcode) {
      errors.push(`Aynı barkod farklı ürünlerde: ${product.barcode} → ${sameBarcode.title || sameBarcode.xmlKey}`);
      checks.duplicateBarcode = false;
    } else {
      checks.duplicateBarcode = true;
    }
  } else {
    checks.duplicateBarcode = true;
  }

  // Aynı SKU farklı ürünlerde
  if (product.sku) {
    const sameSku = allProducts.find(p => p.id !== product.id && p.sku === product.sku);
    if (sameSku) {
      errors.push(`Aynı SKU farklı ürünlerde: ${product.sku} → ${sameSku.title || sameSku.xmlKey}`);
      checks.duplicateSku = false;
    } else {
      checks.duplicateSku = true;
    }
  } else {
    checks.duplicateSku = true;
  }

  // Renk+Numara/Beden kombinasyon tekrarı
  if (product.variants && product.variants.length > 0) {
    const colorVal = product.variants.find(v => v.name === 'Renk')?.value;
    const sizeVal = product.variants.find(v => v.name === 'Beden')?.value;
    const numberVal = product.variants.find(v => v.name === 'Numara')?.value;

    if (colorVal && sizeVal) {
      const sameCombo = allProducts.find(p => {
        if (p.id === product.id) return false;
        const pColor = p.variants?.find(v => v.name === 'Renk')?.value;
        const pSize = p.variants?.find(v => v.name === 'Beden')?.value;
        return pColor === colorVal && pSize === sizeVal;
      });
      if (sameCombo) {
        warnings.push(`Aynı varyant kombinasyonu tekrarlanıyor: ${colorVal}+${sizeVal}`);
        checks.duplicateCombo = false;
      } else {
        checks.duplicateCombo = true;
      }
    } else if (colorVal && numberVal) {
      const sameCombo = allProducts.find(p => {
        if (p.id === product.id) return false;
        const pColor = p.variants?.find(v => v.name === 'Renk')?.value;
        const pNumber = p.variants?.find(v => v.name === 'Numara')?.value;
        return pColor === colorVal && pNumber === numberVal;
      });
      if (sameCombo) {
        warnings.push(`Aynı varyant kombinasyonu tekrarlanıyor: ${colorVal}+${numberVal}`);
        checks.duplicateCombo = false;
      } else {
        checks.duplicateCombo = true;
      }
    } else {
      checks.duplicateCombo = true;
    }
  } else {
    checks.duplicateCombo = true;
  }

  return { errors, warnings, checks };
}

// ==================== ANA ANALİZ MOTORU (TÜM AŞAMALARI ÇALIŞTIRIR) ====================

export async function analyzeProduct(
  product: ProductWithRelations,
  allProducts: ProductWithRelations[],
  xmlFields: Record<string, string>,
  marketplaceKey: string = 'trendyol'
): Promise<VariantAnalysisResult> {
  // ============ AŞAMA 1: XML Varyant Kontrolü ============
  const xmlResult = await analyzeXmlVariant(product, xmlFields);

  // Eğer XML varyant yapısı eksiksizse → direkt AUTO_ACCEPTED
  if (xmlResult.hasParent && xmlResult.score >= 70) {
    return {
      productId: product.id,
      confidence: 100,
      source: 'XML_PARENT',
      status: 'AUTO_ACCEPTED',
      reason: null,
      parentSku: xmlResult.parentSku,
      groupId: generateGroupId(),
      xmlHasParent: true,
      phase: 1,
      checks: xmlResult.details,
      errors: [],
      warnings: [],
    };
  }

  // ============ AŞAMA 2: Varyant Gereklilik Analizi ============
  const requirementResult = analyzeVariantRequirement(product, marketplaceKey);
  if (!requirementResult.needsVariant) {
    return {
      productId: product.id,
      confidence: 100,
      source: 'NO_VARIANT_NEEDED',
      status: 'AUTO_ACCEPTED',
      reason: null,
      parentSku: null,
      groupId: null,
      xmlHasParent: xmlResult.hasParent,
      phase: 2,
      checks: { ...xmlResult.details, noVariantNeeded: true },
      errors: [],
      warnings: [],
    };
  }

  // ============ AŞAMA 3: Kategori Analizi ============
  const categoryResult = analyzeCategory(product);

  // ============ AŞAMA 4: Attribute Analizi ============
  const attributeResult = analyzeAttributes(product, marketplaceKey);

  // ============ AŞAMA 5: Akıllı Varyant Analizi ============
  const smartResult = await smartAnalyze(product, allProducts);

  // ============ AŞAMA 6: Güven Skoru Hesabı ============
  const confidence = calculateConfidenceScore({
    xmlScore: xmlResult.score,
    requirementScore: requirementResult.score,
    categoryScore: categoryResult.score,
    attributeScore: attributeResult.score,
    smartScore: smartResult.score,
  });

  // ============ AŞAMA 7: Çakışma Kontrolü ============
  const conflicts = await detectConflicts(product, allProducts);

  // ============ SON KARAR (YENİ MANTIK) ============
  // KURAL: Parent SKU/attribute eksik olması TEK BAŞINA hata nedeni DEĞİLDİR.
  // Sadece GERÇEK HATALAR (çakışan barkod, çakışan SKU) ERROR olarak işaretlenir.
  let source: VariantAnalysisResult['source'] = 'MANUAL';
  let status: VariantAnalysisResult['status'];
  let reason: string | null = null;
  let parentSku = xmlResult.parentSku || smartResult.parentSku || null;
  let groupId = generateGroupId();

  // Kaynak belirle
  if (xmlResult.score >= 50) source = 'XML_PARENT';
  else if (smartResult.score >= 80) source = 'AI_MATCH';
  else if (smartResult.score >= 50) source = 'AUTO_CREATED';

  // ========== KARAR HİYERARŞİSİ ==========
  
  // 1. ÖNCELİK: Gerçek çakışma hataları (barkod/SKU) → ERROR
  if (conflicts.errors.length > 0) {
    status = 'ERROR';
    reason = conflicts.errors[0];
  }
  // 2. Yüksek güven → AUTO_ACCEPTED
  else if (confidence >= 95) {
    status = 'AUTO_ACCEPTED';
    reason = null;
  }
  // 3. Orta-yüksek güven → AUTO_SUGGEST
  else if (confidence >= 80) {
    status = 'AUTO_SUGGEST';
    reason = smartResult.reason || null;
  }
  // 4. Düşük güven ama attribute eksik → MANUAL_REVIEW (ERROR DEĞİL!)
  else if (attributeResult.missingRequired.length > 0) {
    status = 'MANUAL_REVIEW';
    reason = `Attribute eksik: ${attributeResult.missingRequired.join(', ')}`;
  }
  // 5. Düşük güven → MANUAL_REVIEW
  else {
    status = 'MANUAL_REVIEW';
    if (smartResult.reason) reason = smartResult.reason;
    else reason = 'DG güven skoru yetersiz';
  }

  // SADECE gerçek çakışma varsa ERROR
  // Attribute eksikliği ASLA ERROR değildir, MANUAL_REVIEW'dir
  if (status === 'ERROR' && !reason?.includes('barkod') && !reason?.includes('SKU') && !reason?.includes('sku')) {
    status = 'MANUAL_REVIEW';
    reason = 'DG güven skoru yetersiz, manuel inceleme gerekli';
  }

  // Parent SKU yoksa otomatik oluştur (sadece AUTO_SUGGEST ve üstü için)
  if (!parentSku && (status === 'AUTO_ACCEPTED' || status === 'AUTO_SUGGEST')) {
    parentSku = generateParentSku(product);
  }

  // Tüm check'leri birleştir
  const allChecks: Record<string, boolean> = {
    ...xmlResult.details,
    ...conflicts.checks,
    v2CategoryOk: categoryResult.score >= 50,
    v2AttributeOk: attributeResult.score >= 60,
    v2SmartOk: smartResult.score >= 50,
  };

  return {
    productId: product.id,
    confidence,
    source,
    status,
    reason,
    parentSku,
    groupId,
    xmlHasParent: xmlResult.hasParent,
    phase: confidence >= 95 ? 1 : confidence >= 80 ? 5 : 7,
    checks: allChecks,
    errors: conflicts.errors,
    warnings: [...conflicts.warnings, ...(attributeResult.missingRequired.length > 0 ? [`Eksik attribute: ${attributeResult.missingRequired.join(', ')}`] : [])],
  };
}

// ==================== TOPLU ANALİZ ====================

export async function analyzeAllProducts(
  xmlSourceId?: string,
  marketplaceKey?: string
): Promise<{ results: VariantAnalysisResult[]; stats: AnalysisStats }> {
  const mpKey = marketplaceKey || 'trendyol';

  // ============ CURSOR-BASED PAGINATION ile bellek dostu toplu analiz ============
  // Tüm ürünleri tek seferde belleğe yüklemek yerine,
  // sayfa sayfa (cursor-based) işle
  const results: VariantAnalysisResult[] = [];
  const stats: AnalysisStats = {
    totalProducts: 0,
    xmlVariant: 0,
    autoCreated: 0,
    autoSuggest: 0,
    manualReview: 0,
    errors: 0,
  };

  // XML field bilgilerini al
  let xmlFields: Record<string, string> = {};
  if (xmlSourceId) {
    try {
      const source = await prisma.xmlSource.findUnique({ where: { id: xmlSourceId } });
      if ((source as any)?.fields) {
        xmlFields = typeof (source as any).fields === 'string'
          ? JSON.parse((source as any).fields)
          : (source as any).fields as Record<string, string>;
      }
    } catch {
      // XML field yoksa boş geç
    }
  }

  // Toplam ürün sayısını al
  const where: any = {};
  if (xmlSourceId) where.xmlSourceId = xmlSourceId;
  const totalProducts = await prisma.product.count({ where });
  stats.totalProducts = totalProducts;

  // ============ ÖNCEKİ ANALİZ KAYITLARINI TEMİZLE (Transaction güvenli) ============
  // Yeni analiz başlamadan önce eski kayıtları sil.
  // Silme işlemi sırasında veri kaybı olmaması için önce sil, sonra yeni analiz başlar.
  try {
    if (xmlSourceId) {
      const oldProducts = await prisma.product.findMany({ where: { xmlSourceId }, select: { id: true } });
      const oldIds = oldProducts.map(p => p.id);
      if (oldIds.length > 0) {
        await prisma.variantAnalysis.deleteMany({ where: { productId: { in: oldIds } } });
        console.log(`[VariantV2] Eski analiz kayitlari temizlendi: ${oldIds.length}`);
      }
    } else {
      const oldCount = await prisma.variantAnalysis.count();
      if (oldCount > 0) {
        await prisma.variantAnalysis.deleteMany({});
        console.log(`[VariantV2] Tum eski analiz kayitlari temizlendi: ${oldCount}`);
      }
    }
  } catch (err) {
    console.error('[VariantV2] Temizlik hatasi:', err);
  }

  // Cursor-based pagination ile ürünleri işle
  const PAGE_SIZE = 200;
  let lastId: string | null = null;
  let processedCount = 0;
  const tenPercentStep = Math.max(1, Math.floor(totalProducts / 10));

  // Önceki sayfalardan gelen ürünleri smartAnalyze için aday havuzunda tut
  // (SADECE hafif alanlar: id, title, sku, barcode, brandId, categoryId)
  const candidatePool: ProductWithRelations[] = [];

  while (processedCount < totalProducts) {
    // Sonraki sayfayı getir
    const pageWhere: any = { ...where };
    if (lastId) {
      pageWhere.id = { gt: lastId };
    }

    const productPage = await prisma.product.findMany({
      where: pageWhere,
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        xmlSource: { select: { id: true, name: true } },
        variants: { select: { id: true, name: true, value: true } },
      },
    }) as ProductWithRelations[];

    if (productPage.length === 0) break;

    // Analiz için aday havuzu = mevcut sayfa + önceki sayfalardan gelen ürünler
    // Bu sayede smartAnalyze tüm ürünlerle karşılaştırma yapabilir
    const analysisPool = [...candidatePool, ...productPage];

    const batchResults = await Promise.all(
      productPage.map(product => analyzeProduct(product, analysisPool, xmlFields, mpKey))
    );

    for (const r of batchResults) {
      if (r.status === 'AUTO_ACCEPTED') stats.xmlVariant++;
      else if (r.status === 'AUTO_SUGGEST') stats.autoSuggest++;
      else if (r.status === 'MANUAL_REVIEW') stats.manualReview++;
      else if (r.status === 'ERROR') stats.errors++;

      // Bellek dostu: Her 200 kayıtta bir batch olarak kaydet, results'ta tutma
      await saveAnalysisResults([r]);
    }

    // Mevcut sayfadaki ürünleri aday havuzuna ekle (sadece hafif alanlar)
    candidatePool.push(...productPage);

    // Cursor'ı güncelle
    lastId = productPage[productPage.length - 1].id;
    processedCount += productPage.length;

    // İlerleme raporu
    if (processedCount % tenPercentStep === 0 || processedCount === totalProducts) {
      const pct = Math.round((processedCount / totalProducts) * 100);
      console.log(`[VariantV2] Analiz ilerleme: ${processedCount}/${totalProducts} (%${pct}) - XML:${stats.xmlVariant} Öneri:${stats.autoSuggest} Manuel:${stats.manualReview} Hata:${stats.errors}`);
    }
  }

  stats.autoCreated = stats.autoSuggest + stats.manualReview;

  console.log(`[VariantV2] Analiz tamam: ${totalProducts} ürün işlendi`);
  return { results: [], stats };
}

// ==================== VERİTABANI KAYIT ====================

async function saveAnalysisResults(results: VariantAnalysisResult[]): Promise<void> {
  const batchSize = 100;
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    await Promise.all(
      batch.map(r =>
        prisma.variantAnalysis.upsert({
          // NOT: ID formatı her zaman "va_{productId}" şeklindedir.
          // Bu, aynı ürün için her zaman aynı kaydın güncellenmesini sağlar.
          // groupId değişse bile aynı kayıt güncellenir, çift kayıt oluşmaz.
          where: { id: `va_${r.productId}` },
          create: {
            id: `va_${r.productId}`,
            productId: r.productId,
            confidence: r.confidence,
            source: r.source,
            status: r.status,
            reason: r.reason,
            parentSku: r.parentSku,
            groupId: r.groupId,
            xmlHasParent: r.xmlHasParent,
            checkResults: JSON.stringify({
              checks: r.checks,
              errors: r.errors,
              warnings: r.warnings,
              phase: r.phase,
            }),
          },
          update: {
            confidence: r.confidence,
            source: r.source,
            status: r.status,
            reason: r.reason,
            parentSku: r.parentSku,
            groupId: r.groupId,
            xmlHasParent: r.xmlHasParent,
            checkResults: JSON.stringify({
              checks: r.checks,
              errors: r.errors,
              warnings: r.warnings,
              phase: r.phase,
            }),
          },
        })
      )
    );
  }
}

// ==================== İSTATİSTİK ====================

export async function getAnalysisStats(xmlSourceId?: string): Promise<AnalysisStats> {
  const where: any = {};
  if (xmlSourceId) {
    const products = await prisma.product.findMany({
      where: { xmlSourceId },
      select: { id: true },
    });
    where.productId = { in: products.map(p => p.id) };
  }

  let totalProducts = 0;
  if (xmlSourceId) {
    totalProducts = await prisma.product.count({ where: { xmlSourceId } });
  } else {
    totalProducts = await prisma.product.count();
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
    totalProducts,
    xmlVariant: (statusMap['AUTO_ACCEPTED'] || 0),
    autoCreated: (statusMap['AUTO_SUGGEST'] || 0) + (statusMap['MANUAL_REVIEW'] || 0),
    autoSuggest: statusMap['AUTO_SUGGEST'] || 0,
    manualReview: statusMap['MANUAL_REVIEW'] || 0,
    errors: statusMap['ERROR'] || 0,
  };
}

// ==================== SORUNLU ÜRÜNLER (VARYANT EKRANI İÇİN) ====================

export async function getVariantScreenProducts(
  filters: {
    status?: string;
    xmlSourceId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ items: VariantScreenProduct[]; total: number }> {
  const {
    status,
    xmlSourceId,
    search,
    page = 1,
    limit = 50,
  } = filters;

  // VariantAnalysis'den sorgula
  const vaWhere: any = {};
  
  // Status filtreleme
  if (status && status !== 'all') {
    vaWhere.status = status;
  } else {
    // Varsayılan: Sadece manuel inceleme ve hatalı ürünleri göster
    vaWhere.status = { in: ['MANUAL_REVIEW', 'ERROR'] };
  }

  // XML kaynağı filtresi
  if (xmlSourceId) {
    const products = await prisma.product.findMany({
      where: { xmlSourceId },
      select: { id: true },
    });
    vaWhere.productId = { in: products.map(p => p.id) };
  }

  // Arama
  if (search) {
    const searchProducts = await prisma.product.findMany({
      where: {
        OR: [
          { title: { contains: search } },
          { sku: { contains: search } },
          { xmlKey: { contains: search } },
          { barcode: { contains: search } },
        ],
      },
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

  // Ürün bilgilerini getir
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

  const screenItems: VariantScreenProduct[] = items.map(item => {
    const product = productMap.get(item.productId);
    let checkResults: { errors?: string[]; warnings?: string[] } = { errors: [], warnings: [] };
    if (item.checkResults) {
      try {
        checkResults = JSON.parse(item.checkResults);
      } catch {
        checkResults = { errors: [], warnings: [] };
      }
    }

    // Önerilen işlem
    let suggestedAction: string | null = null;
    if (item.status === 'ERROR') {
      if (checkResults.errors?.some((e: string) => e.includes('barkod'))) {
        suggestedAction = 'Barkod hatası - manuel düzeltme gerekli';
      } else if (checkResults.errors?.some((e: string) => e.includes('SKU'))) {
        suggestedAction = 'SKU çakışması - manuel düzeltme gerekli';
      } else {
        suggestedAction = 'Manuel inceleme gerekli';
      }
    } else if (item.status === 'MANUAL_REVIEW') {
      if (item.reason?.includes('Attribute')) {
        suggestedAction = 'Eksik attribute ekleyin';
      } else if (item.reason?.includes('Benzerlik')) {
        suggestedAction = 'Otomatik eşleştirme dene veya manuel eşleştir';
      } else {
        suggestedAction = 'Manuel inceleme';
      }
    } else if (item.status === 'AUTO_SUGGEST') {
      suggestedAction = 'Onayla ve uygula';
    }

    return {
      id: product?.id || item.productId,
      sku: product?.sku || null,
      xmlKey: product?.xmlKey || '',
      title: product?.title || null,
      barcode: product?.barcode || null,
      brandName: product?.brand?.name || null,
      categoryName: product?.category?.name || product?.supplierCategory || null,
      xmlSourceName: product?.xmlSource?.name || null,
      confidence: item.confidence,
      status: item.status,
      reason: item.reason || null,
      suggestedAction,
      hasColor: product?.variants?.some(v => v.name === 'Renk') || false,
      hasSize: product?.variants?.some(v => v.name === 'Beden') || false,
      hasNumber: product?.variants?.some(v => v.name === 'Numara') || false,
      parentSku: item.parentSku,
      groupId: item.groupId,
    };
  });

  return { items: screenItems, total };
}

// ==================== OTOMATİK EŞLEŞTİR ====================

export async function autoMatchProducts(productIds: string[]): Promise<{
  matched: number;
  failed: number;
  preview: Array<{ productId: string; parentSku: string; groupId: string; confidence: number }>;
}> {
  // Hedef ürünleri getir (verilen ID'lere göre)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      xmlSource: { select: { id: true, name: true } },
      variants: { select: { id: true, name: true, value: true } },
    },
  }) as ProductWithRelations[];

  // Bellek patlamasını önlemek için tüm ürünleri TEK SEFERDE yüklemek yerine,
  // cursor-based pagination ile sayfa sayfa işle.
  // Sadece smartAnalyze için gerekli alanları (id, title, sku, barcode, brandId, categoryId) içeren
  // hafif bir aday havuzu oluştur.
  let matched = 0;
  let failed = 0;
  const preview: Array<{ productId: string; parentSku: string; groupId: string; confidence: number }> = [];

  // Tüm ürünlerden hafif bir aday havuzu oluştur (cursor-based pagination ile)
  const allCandidatePool: ProductWithRelations[] = [];
  const PAGE_SIZE = 500;
  let lastId: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const pageWhere: any = {};
    if (lastId) pageWhere.id = { gt: lastId };

    const page = await prisma.product.findMany({
      where: pageWhere,
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        variants: { select: { id: true, name: true, value: true } },
      },
    }) as ProductWithRelations[];

    if (page.length === 0) break;
    allCandidatePool.push(...page);
    lastId = page[page.length - 1].id;
    if (page.length < PAGE_SIZE) hasMore = false;
  }

  for (const product of products) {
    const smartResult = await smartAnalyze(product, allCandidatePool);
    
    if (smartResult.score >= 80 && smartResult.parentSku) {
      const groupId = generateGroupId();
      preview.push({
        productId: product.id,
        parentSku: smartResult.parentSku,
        groupId,
        confidence: smartResult.score,
      });
      matched++;
    } else {
      failed++;
    }
  }

  return { matched, failed, preview };
}

// ==================== MANUEL EŞLEŞTİRME KAYDI ====================

export async function manualMatchProducts(
  matches: Array<{ productIds: string[]; parentSku: string; groupId: string }>
): Promise<{ totalUpdated: number }> {
  let totalUpdated = 0;

  for (const match of matches) {
    const gId = match.groupId || generateGroupId();
    
    for (const productId of match.productIds) {
      await prisma.variantAnalysis.upsert({
        // NOT: "va_" prefix'li ID formatı (servis katmanıyla tutarlı)
        where: { id: `va_${productId}` },
        create: {
          id: `va_${productId}`,
          productId,
          confidence: 100,
          source: 'MANUAL',
          status: 'AUTO_ACCEPTED',
          reason: null,
          parentSku: match.parentSku,
          groupId: gId,
          xmlHasParent: false,
          checkResults: JSON.stringify({ manualMatch: true }),
        },
        update: {
          confidence: 100,
          source: 'MANUAL',
          status: 'AUTO_ACCEPTED',
          reason: null,
          parentSku: match.parentSku,
          groupId: gId,
        },
      });
      totalUpdated++;
    }
  }

  return { totalUpdated };
}

// ==================== YENİDEN ANALİZ (BELİRLİ ÜRÜNLER İÇİN) ====================

export async function reanalyzeProducts(productIds: string[], marketplaceKey?: string): Promise<{
  results: VariantAnalysisResult[];
  stats: AnalysisStats;
}> {
  const mpKey = marketplaceKey || 'trendyol';

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      xmlSource: { select: { id: true, name: true } },
      variants: { select: { id: true, name: true, value: true } },
    },
  }) as ProductWithRelations[];

  // Bellek patlamasını önlemek için tüm ürünleri cursor-based pagination ile
  // sayfa sayfa yükle ve aday havuzu oluştur
  const allCandidatePool: ProductWithRelations[] = [];
  const PAGE_SIZE = 500;
  let lastId: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const pageWhere: any = {};
    if (lastId) pageWhere.id = { gt: lastId };

    const page = await prisma.product.findMany({
      where: pageWhere,
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        variants: { select: { id: true, name: true, value: true } },
      },
    }) as ProductWithRelations[];

    if (page.length === 0) break;
    allCandidatePool.push(...page);
    lastId = page[page.length - 1].id;
    if (page.length < PAGE_SIZE) hasMore = false;
  }

  const results: VariantAnalysisResult[] = [];
  
  for (const product of products) {
    const result = await analyzeProduct(product, allCandidatePool, {}, mpKey);
    results.push(result);
  }

  const stats: AnalysisStats = {
    totalProducts: results.length,
    xmlVariant: results.filter(r => r.status === 'AUTO_ACCEPTED').length,
    autoCreated: results.filter(r => r.status === 'AUTO_SUGGEST' || r.status === 'MANUAL_REVIEW').length,
    autoSuggest: results.filter(r => r.status === 'AUTO_SUGGEST').length,
    manualReview: results.filter(r => r.status === 'MANUAL_REVIEW').length,
    errors: results.filter(r => r.status === 'ERROR').length,
  };

  await saveAnalysisResults(results);

  return { results, stats };
}
