// ==================== KARAR MOTORU V5.0 ENTERPRISE ====================
// DG STOK V5.0 - Gerçek Varyant Tespit Motoru (Madde 3-7)
// 6 aşamalı karar ağacı
// Karar: Gerçek varyant ilişkilerine göre verilir:
//   Supplier Group → Parent SKU → Variant Group ID → SKU Pattern → Başlık Benzerliği → Barkod Ailesi
// Hiçbiri eşleşmezse → NO_VARIANT_REQUIRED (varyantsız kabul edilir)
// ======================================================================

import { prisma } from '../../db/prisma.ts';
import type { V5Product, VariantDecision, CategoryVariantConfig, ExtractedVariant } from './types.ts';
import type { IDecisionEngine } from './interfaces.ts';
import { categoryEngine } from './categoryEngine.ts';
import { THRESHOLDS } from './constants.ts';

export class DecisionEngine implements IDecisionEngine {
  async decide(product: V5Product, categoryConfig: CategoryVariantConfig | null): Promise<VariantDecision> {
    const timestamp = new Date().toISOString();

    // ===== KARAR AĞACI (Madde 3 - 6 aşama) =====
    // Sıra: Gerçek varyant ilişkisi araştırılır
    // 1. Tedarikçi Ürün Grubu
    // 2. Parent SKU
    // 3. Variant Group ID
    // 4. SKU Pattern
    // 5. Başlık Benzerliği
    // 6. Barkod Ailesi
    // HİÇBİRİ EŞLEŞMEZSE → NO_VARIANT_REQUIRED

    // Adım 1: Tedarikçi Ürün Grubu (Supplier Group)
    let result = await this.checkSupplierGroup(product);
    if (result) return result;

    // Adım 2: Parent SKU
    result = await this.checkParentSku(product);
    if (result) return result;

    // Adım 3: Variant Group ID (supplierCategory üzerinden)
    result = await this.checkVariantGroupId(product);
    if (result) return result;

    // Adım 4: SKU Pattern
    result = await this.checkSkuPattern(product);
    if (result) return result;

    // Adım 5: Başlık Benzerliği (Supplier Mapping)
    result = await this.checkSupplierMapping(product);
    if (result) return result;

    // Adım 6: Barkod Ailesi (Barcode Family)
    result = await this.checkBarcodeFamily(product);
    if (result) return result;

    // ===== HİÇBİRİ EŞLEŞMEDİ → NO_VARIANT_REQUIRED =====
    const config = categoryConfig ?? await categoryEngine.getCategoryConfig(product.categoryId ?? '');

    return {
      productId: product.id,
      status: 'NO_VARIANT_REQUIRED',
      confidence: 100,
      source: 'XML_ANALYSIS',
      reason: 'XML analizi sonucu gerçek varyant ilişkisi bulunamadı. Ürün varyantsız kabul edildi.',
      extractedVariants: [],
      familyId: null,
      errors: [],
      warnings: config?.variantRequired ? ['Kategori varyant gerektiriyor ancak XML içinde varyant bulunamadı'] : [],
      categoryConfig: config,
      timestamp,
    };
  }

  async decideBatch(products: V5Product[]): Promise<VariantDecision[]> {
    const decisions: VariantDecision[] = [];
    for (const product of products) {
      const config = product.categoryId
        ? await categoryEngine.getCategoryConfig(product.categoryId)
        : null;
      const decision = await this.decide(product, config);
      decisions.push(decision);
    }
    return decisions;
  }

  // Adım 1: Tedarikçi Ürün Grubu (Supplier Group)
  // Aynı xmlSourceId ve supplierCategory'e sahip ürünlerden
  // en az 2 tanesinin başlığı benzer ise → VARYANT
  private async checkSupplierGroup(product: V5Product): Promise<VariantDecision | null> {
    if (!product.xmlSourceId || !product.supplierCategory) return null;

    const siblings = await prisma.product.findMany({
      where: {
        xmlSourceId: product.xmlSourceId,
        supplierCategory: product.supplierCategory,
        id: { not: product.id },
      },
      select: { id: true, title: true, sku: true, barcode: true },
      take: 20,
    });

    if (siblings.length < 2) return null;

    const productBaseName = this.extractBaseName(product.title || '');
    const matchingSiblings = siblings.filter(s => {
      const siblingBase = this.extractBaseName(s.title || '');
      return siblingBase && productBaseName && (
        siblingBase.includes(productBaseName) || productBaseName.includes(siblingBase)
      );
    });

    if (matchingSiblings.length >= 2) {
      return {
        productId: product.id,
        status: 'AUTO_APPROVED',
        confidence: 95,
        source: 'XML_ANALYSIS',
        reason: `Tedarikçi ürün grubu: "${productBaseName}" (${matchingSiblings.length + 1} ürün)`,
        extractedVariants: [],
        familyId: null,
        errors: [],
        warnings: [],
        categoryConfig: null,
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }

  // Adım 2: Parent SKU
  // SKU'da "ABC-001", "ABC-002" gibi bir pattern varsa
  // ve aynı parent'a sahip başka ürünler de varsa → VARYANT
  private async checkParentSku(product: V5Product): Promise<VariantDecision | null> {
    if (!product.sku) return null;

    const skuParts = product.sku.split('-');
    if (skuParts.length < 2) return null;

    const parentSku = skuParts.slice(0, -1).join('-');
    if (parentSku.length < 3) return null;

    const siblingCount = await prisma.product.count({
      where: {
        xmlSourceId: product.xmlSourceId,
        sku: { startsWith: parentSku + '-' },
        id: { not: product.id },
      },
    });

    if (siblingCount >= 1) {
      return {
        productId: product.id,
        status: 'AUTO_APPROVED',
        confidence: 95,
        source: 'XML_ANALYSIS',
        reason: `Parent SKU: ${parentSku} (${siblingCount + 1} varyant)`,
        extractedVariants: [],
        familyId: parentSku,
        errors: [],
        warnings: [],
        categoryConfig: null,
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }

  // Adım 3: Variant Group ID (supplierCategory üzerinden)
  // Aynı supplierCategory (kategori yolu) altında birden çok ürün varsa → VARYANT
  private async checkVariantGroupId(product: V5Product): Promise<VariantDecision | null> {
    if (!product.supplierCategory) return null;

    const catParts = product.supplierCategory.split('>').map(s => s.trim());
    const modelHint = catParts[catParts.length - 1];

    if (modelHint && modelHint.length > 2) {
      const siblings = await prisma.product.count({
        where: {
          xmlSourceId: product.xmlSourceId,
          supplierCategory: product.supplierCategory,
          id: { not: product.id },
        },
      });

      if (siblings >= 1) {
        return {
          productId: product.id,
          status: 'AUTO_APPROVED',
          confidence: 90,
          source: 'XML_ANALYSIS',
          reason: `Varyant grubu: "${product.supplierCategory}" (${siblings + 1} ürün)`,
          extractedVariants: [],
          familyId: modelHint,
          errors: [],
          warnings: [],
          categoryConfig: null,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return null;
  }

  // Adım 4: SKU Pattern
  // SKU'da ayraç (separator) varsa ve aynı base SKU'ya sahip başka ürünler varsa → VARYANT
  private async checkSkuPattern(product: V5Product): Promise<VariantDecision | null> {
    if (!product.sku) return null;

    const separators = ['-', '_', '/', '#'];
    for (const sep of separators) {
      if (product.sku.includes(sep)) {
        const parts = product.sku.split(sep);
        if (parts.length >= 2) {
          const base = parts.slice(0, -1).join(sep);
          if (base.length >= 3) {
            const siblings = await prisma.product.count({
              where: {
                xmlSourceId: product.xmlSourceId,
                sku: { startsWith: base + sep },
                id: { not: product.id },
              },
            });
            if (siblings >= 1) {
              return {
                productId: product.id,
                status: 'AUTO_APPROVED',
                confidence: 88,
                source: 'XML_ANALYSIS',
                reason: `SKU pattern: "${base}${sep}..." (${siblings + 1} ürün)`,
                extractedVariants: [],
                familyId: base,
                errors: [],
                warnings: [],
                categoryConfig: null,
                timestamp: new Date().toISOString(),
              };
            }
          }
        }
      }
    }

    return null;
  }

  // Adım 5: Başlık Benzerliği (Supplier Mapping)
  // Aynı xmlSourceId içinde başlıkları benzer olan ürünler varsa → VARYANT
  private async checkSupplierMapping(product: V5Product): Promise<VariantDecision | null> {
    if (!product.xmlSourceId || !product.title) return null;

    const baseName = this.extractBaseName(product.title);
    if (!baseName || baseName.length < 5) return null;

    const siblings = await prisma.product.findMany({
      where: {
        xmlSourceId: product.xmlSourceId,
        id: { not: product.id },
      },
      select: { id: true, title: true },
      take: 50,
    });

    const sameModel = siblings.filter(s => {
      const sb = this.extractBaseName(s.title || '');
      return sb && (sb.includes(baseName) || baseName.includes(sb));
    });

    if (sameModel.length >= 2) {
      return {
        productId: product.id,
        status: 'AUTO_APPROVED',
        confidence: 85,
        source: 'XML_ANALYSIS',
        reason: `Başlık benzerliği: "${baseName}" (${sameModel.length + 1} ürün)`,
        extractedVariants: [],
        familyId: baseName,
        errors: [],
        warnings: [],
        categoryConfig: null,
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }

  // Adım 6: Barkod Ailesi (Barcode Family)
  // Barkod ön eki aynı olan başka ürünler varsa → VARYANT
  private async checkBarcodeFamily(product: V5Product): Promise<VariantDecision | null> {
    if (!product.barcode || product.barcode.length < 5) return null;

    const prefix = product.barcode.substring(0, Math.min(7, product.barcode.length - 3));

    const siblings = await prisma.product.count({
      where: {
        xmlSourceId: product.xmlSourceId,
        barcode: { startsWith: prefix },
        id: { not: product.id },
      },
    });

    if (siblings >= 1) {
      return {
        productId: product.id,
        status: 'AUTO_APPROVED',
        confidence: 80,
        source: 'XML_ANALYSIS',
        reason: `Barkod ailesi: "${prefix}..." (${siblings + 1} ürün)`,
        extractedVariants: [],
        familyId: null,
        errors: [],
        warnings: [],
        categoryConfig: null,
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }

  // Yardımcı: Ana model adını çıkar (renk/beden/no gibi varyant kelimelerini temizler)
  private extractBaseName(title: string): string | null {
    if (!title) return null;

    const variantWords = [
      'siyah', 'beyaz', 'kırmızı', 'mavi', 'yeşil', 'sarı', 'mor', 'turuncu', 'gri', 'pembe',
      'lacivert', 'bordo', 'krem', 'bej', 'kahverengi', 'metalik', 'altın', 'gümüş',
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'gray', 'pink',
      'navy', 'burgundy', 'cream', 'beige', 'brown', 'gold', 'silver',
      'small', 'medium', 'large', 'xlarge', 'xxlarge', 'xs', 's', 'm', 'l', 'xl', 'xxl',
      'küçük', 'orta', 'büyük',
      '38', '39', '40', '41', '42', '43', '44', '45', '46',
      'tek', 'çift', 'set', 'paket',
    ];

    let cleaned = title.toLowerCase().trim();
    for (const word of variantWords) {
      cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    }

    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    const words = cleaned.split(' ');
    if (words.length < 2) return title;

    return words.slice(0, Math.min(3, words.length)).join(' ');
  }
}

export const decisionEngine = new DecisionEngine();
