// ==================== ÜRÜN AİLESİ MOTORU V5.0 ====================
// DG STOK V5.0 - Ürün adına göre aile oluşturma (Madde 9)
// ================================================================

import type { V5Product, ProductFamily, VariantDecision, ExtractedVariant } from './types.ts';
import type { IFamilyEngine } from './interfaces.ts';
import { aiExtractor } from './aiExtractor.ts';
import { THRESHOLDS } from './constants.ts';

export class FamilyEngine implements IFamilyEngine {
  async findFamilies(
    products: V5Product[],
    existingDecisions: Map<string, VariantDecision>
  ): Promise<Map<string, ProductFamily>> {
    const families = new Map<string, ProductFamily>();

    // Marka + kategori bazında grupla
    const groups = new Map<string, V5Product[]>();
    for (const p of products) {
      const key = `${p.brandId || 'no_brand'}_${p.categoryId || 'no_cat'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    for (const [, groupProducts] of groups) {
      // Her grupta model adına göre alt gruplar oluştur
      const modelGroups = new Map<string, V5Product[]>();

      for (const p of groupProducts) {
        const modelName = aiExtractor.extractModelName(p.title || p.xmlKey);
        if (!modelGroups.has(modelName)) modelGroups.set(modelName, []);
        modelGroups.get(modelName)!.push(p);
      }

      for (const [modelName, members] of modelGroups) {
        if (members.length < 2) continue; // Tek ürün aile oluşturmaz

        const family = this.createFamily(modelName, members);

        // Her üye için çıkarılan varyantları bul
        for (const member of members) {
          const decision = existingDecisions.get(member.id);
          if (decision) {
            const memberEntry = family.products.find(p => p.productId === member.id);
            if (memberEntry) {
              memberEntry.extractedVariants = decision.extractedVariants;
            }
          }
        }

        families.set(family.id, family);
      }
    }

    return families;
  }

  createFamily(modelName: string, products: V5Product[]): ProductFamily {
    const firstProduct = products[0];
    const id = `fam_${Buffer.from(modelName).toString('base64').slice(0, 20)}_${Date.now()}`;

    return {
      id,
      modelName,
      brandName: firstProduct.brand?.name ?? null,
      categoryName: firstProduct.category?.name ?? null,
      products: products.map(p => ({
        productId: p.id,
        extractedVariants: [],
      })),
      confidence: Math.min(100, products.length * 10 + 50), // 2 ürün = %70, 5 ürün = %100
    };
  }

  async mergeFamilies(families: Map<string, ProductFamily>): Promise<Map<string, ProductFamily>> {
    const merged = new Map<string, ProductFamily>();

    for (const [, family] of families) {
      const key = family.modelName.toLowerCase().trim();

      if (merged.has(key)) {
        const existing = merged.get(key)!;
        existing.products.push(...family.products);
        existing.confidence = Math.min(100, existing.confidence + 5);
      } else {
        merged.set(key, family);
      }
    }

    return merged;
  }
}

export const familyEngine = new FamilyEngine();
