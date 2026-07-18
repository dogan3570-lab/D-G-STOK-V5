// ==================== AI VARYANT ÇIKARICI V5.0 ====================
// DG STOK V5.0 - Ürün adı, açıklama ve XML'den varyant çıkarımı
// ================================================================

import type { V5Product, ExtractedVariant, CategoryVariantConfig, AIExtractionResult, VariantAttributeType, DecisionSource } from './types.ts';
import type { IAIExtractor } from './interfaces.ts';
import {
  VARIANT_KEYWORDS,
  PATTERNS,
  THRESHOLDS,
  CATEGORY_VARIANT_REQUIRED_FALSE_KEYWORDS,
} from './constants.ts';

export class AIExtractor implements IAIExtractor {
  async extractFromTitle(title: string, categoryConfig: CategoryVariantConfig | null): Promise<ExtractedVariant[]> {
    const variants: ExtractedVariant[] = [];
    const lowerTitle = title.toLowerCase();

    // Renk çıkarımı
    const colorMatch = lowerTitle.match(PATTERNS.COLOR_WORD);
    if (colorMatch) {
      variants.push({
        type: 'RENK',
        value: colorMatch[0],
        confidence: 90,
        source: 'TITLE_EXTRACTION',
        rawMatch: colorMatch[0],
      });
    }

    // Beden/Numara çıkarımı (2 haneli sayılar)
    const sizeMatches = lowerTitle.matchAll(PATTERNS.SIZE_NUMBER);
    for (const match of sizeMatches) {
      const num = parseInt(match[1], 10);
      if (num >= 32 && num <= 60) {
        // Ayakkabı numarası veya beden
        const type = (num >= 35 && num <= 48) ? 'NUMARA' : 'BEDEN';
        variants.push({
          type,
          value: match[1],
          confidence: 85,
          source: 'TITLE_EXTRACTION',
          rawMatch: match[0],
        });
      }
    }

    // Anahtar kelime bazlı çıkarım
    for (const [type, keywords] of Object.entries(VARIANT_KEYWORDS)) {
      for (const kw of keywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        if (regex.test(lowerTitle)) {
          // Değeri bul (kelimenin yanındaki sayı)
          const valueMatch = lowerTitle.match(new RegExp(`${kw}\\s*(\\d+[.,]?\\d*)\\s*(cm|mm|m|lt|ml|kg|gr|adet)?`, 'i'));
          if (valueMatch) {
            variants.push({
              type: type as VariantAttributeType,
              value: valueMatch[1] + (valueMatch[2] || ''),
              confidence: 75,
              source: 'TITLE_EXTRACTION',
              rawMatch: valueMatch[0],
            });
          }
          break;
        }
      }
    }

    // Kategori destekliyorsa sadece o tipleri döndür
    if (categoryConfig && categoryConfig.supportedVariantTypes.length > 0) {
      return variants.filter(v => categoryConfig.supportedVariantTypes.includes(v.type));
    }

    return variants;
  }

  async extractFromDescription(description: string, categoryConfig: CategoryVariantConfig | null): Promise<ExtractedVariant[]> {
    const variants: ExtractedVariant[] = [];
    const lowerDesc = description.toLowerCase();

    // Açıklamadan teknik özellikleri çıkar
    // Örn: "Renk: Siyah", "Beden: 42", "100 ml"
    const techSpecs = [
      /renk[:\s]+([a-zğüşıöç]+)/gi,
      /color[:\s]+([a-z]+)/gi,
      /beden[:\s]+([a-z0-9]+)/gi,
      /size[:\s]+([a-z0-9]+)/gi,
      /(\d+[.,]?\d*)\s*(ml|lt|litre|cc)/gi,
      /(\d+[.,]?\d*)\s*(kg|gr|gram)/gi,
      /(\d+[.,]?\d*)\s*(cm|mm|metre|m)/gi,
      /(\d+)\s*adet/gi,
    ];

    for (const pattern of techSpecs) {
      const matches = lowerDesc.matchAll(pattern);
      for (const match of matches) {
        let type: VariantAttributeType = 'ADET';
        if (match[0].includes('renk') || match[0].includes('color')) type = 'RENK';
        else if (match[0].includes('beden') || match[0].includes('size')) type = 'BEDEN';
        else if (match[0].includes('ml') || match[0].includes('litre') || match[0].includes('cc')) type = 'ML';
        else if (match[0].includes('kg') || match[0].includes('gram')) type = 'AGIRLIK';
        else if (match[0].includes('cm') || match[0].includes('mm') || match[0].includes('metre')) type = 'CM';

        variants.push({
          type,
          value: match[1] || match[0],
          confidence: 80,
          source: 'DESCRIPTION_EXTRACTION',
          rawMatch: match[0],
        });
      }
    }

    return variants;
  }

  async analyzeProduct(product: V5Product, categoryConfig: CategoryVariantConfig | null): Promise<AIExtractionResult> {
    const allVariants: ExtractedVariant[] = [];

    // 1. Başlıktan çıkar
    if (product.title) {
      const titleVariants = await this.extractFromTitle(product.title, categoryConfig);
      allVariants.push(...titleVariants);
    }

    // 2. Açıklamadan çıkar
    if (product.description) {
      const descVariants = await this.extractFromDescription(product.description, categoryConfig);
      // Başlıkta bulunmayanları ekle
      for (const dv of descVariants) {
        if (!allVariants.some(av => av.type === dv.type && av.value === dv.value)) {
          allVariants.push(dv);
        }
      }
    }

    // 3. Varsa mevcut varyantları ekle
    if (product.variants) {
      for (const v of product.variants) {
        if (!allVariants.some(av => av.type === v.name && av.value === v.value)) {
          allVariants.push({
            type: this.detectType(v.name),
            value: v.value,
            confidence: 100,
            source: 'XML_ANALYSIS',
            rawMatch: `${v.name}: ${v.value}`,
          });
        }
      }
    }

    // 4. Model adını çıkar
    const modelName = this.extractModelName(product.title || product.xmlKey);

    // 5. Güven skoru hesapla
    const confidence = this.calculateConfidence(allVariants, categoryConfig);

    // 6. Otomatik oluşturulabilir mi?
    const canAutoCreate = confidence >= THRESHOLDS.AUTO_CREATE_CONFIDENCE && allVariants.length > 0;

    return {
      productId: product.id,
      extractedVariants: allVariants,
      confidence,
      modelName,
      suggestedFamilyId: null,
      canAutoCreate,
      reason: canAutoCreate
        ? `AI ${allVariants.length} varyant çıkardı (güven: %${confidence})`
        : allVariants.length > 0
          ? `${allVariants.length} varyant bulundu ancak güven düşük (%${confidence})`
          : 'Hiçbir varyant bulunamadı',
    };
  }

  extractModelName(title: string): string {
    // Marka + ürün adı (renk/beden/no olmayan kısım)
    let model = title.toLowerCase();

    // Renkleri temizle
    const colorMatch = model.match(PATTERNS.COLOR_WORD);
    if (colorMatch) {
      for (const c of colorMatch) {
        model = model.replace(c, '');
      }
    }

    // Beden/Numaraları temizle
    model = model.replace(PATTERNS.SIZE_NUMBER, '');

    // Anahtar kelimeleri temizle
    for (const [, keywords] of Object.entries(VARIANT_KEYWORDS)) {
      for (const kw of keywords) {
        model = model.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '');
      }
    }

    // Fazla boşlukları temizle
    return model.replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  // ==================== YARDIMCI ====================

  private detectType(name: string): VariantAttributeType {
    const lower = name.toLowerCase();
    if (['renk', 'color', 'colour'].includes(lower)) return 'RENK';
    if (['beden', 'size'].includes(lower)) return 'BEDEN';
    if (['numara', 'number', 'no'].includes(lower)) return 'NUMARA';
    return 'ADET';
  }

  private calculateConfidence(variants: ExtractedVariant[], categoryConfig: CategoryVariantConfig | null): number {
    if (variants.length === 0) return 0;

    let score = 0;

    // Her varyant için puan
    for (const v of variants) {
      score += v.confidence;
    }

    // Ortalama güven
    score = Math.round(score / variants.length);

    // Kategori desteği varsa bonus
    if (categoryConfig && categoryConfig.supportedVariantTypes.length > 0) {
      const supportedCount = variants.filter(v => categoryConfig.supportedVariantTypes.includes(v.type)).length;
      if (supportedCount === variants.length) {
        score = Math.min(100, score + 10);
      }
    }

    // Çok sayıda varyant bulunduysa bonus
    if (variants.length >= 2) score = Math.min(100, score + 5);
    if (variants.length >= 3) score = Math.min(100, score + 5);

    return score;
  }
}

export const aiExtractor = new AIExtractor();
