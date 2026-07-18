// ==================== KATEGORİ MOTORU V5.0 ====================
// DG STOK V5.0 - Category-Based Variant Decision
// ============================================================

import { prisma } from '../../db/prisma.ts';
import type { CategoryVariantConfig } from './types.ts';
import type { ICategoryEngine } from './interfaces.ts';
import { CATEGORY_VARIANT_REQUIRED_FALSE_KEYWORDS, CATEGORY_VARIANT_REQUIRED_TRUE_KEYWORDS } from './constants.ts';

export class CategoryEngine implements ICategoryEngine {
  private cache = new Map<string, CategoryVariantConfig>();

  async getCategoryConfig(categoryId: string): Promise<CategoryVariantConfig | null> {
    if (this.cache.has(categoryId)) {
      return this.cache.get(categoryId) ?? null;
    }

    try {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: {
          id: true,
          name: true,
        },
      });

      if (!category) return null;

      const config = this.buildCategoryConfig(category);
      this.cache.set(categoryId, config);
      return config;
    } catch {
      return null;
    }
  }

  async getCategoryConfigs(categoryIds: string[]): Promise<Map<string, CategoryVariantConfig>> {
    const result = new Map<string, CategoryVariantConfig>();
    const uncached = categoryIds.filter(id => !this.cache.has(id));

    if (uncached.length > 0) {
      try {
        const categories = await prisma.category.findMany({
          where: { id: { in: uncached } },
          select: { id: true, name: true },
        });

        for (const cat of categories) {
          const config = this.buildCategoryConfig(cat);
          this.cache.set(cat.id, config);
        }
      } catch { /* ignore */ }
    }

    for (const id of categoryIds) {
      const config = this.cache.get(id);
      if (config) result.set(id, config);
    }

    return result;
  }

  async updateCategoryConfig(_categoryId: string, _config: Partial<CategoryVariantConfig>): Promise<void> {
    // variantRequired alanı Prisma schema'da bulunmuyor
    // Bu özellik kategori adı keyword analizi ile belirlenir
    // İleride schema'ya eklenirse bu metot aktif edilebilir
    return;
  }

  async isVariantRequired(categoryId: string): Promise<boolean> {
    const config = await this.getCategoryConfig(categoryId);
    return config?.variantRequired ?? true; // Varsayılan: true
  }

  // ==================== KATEGORİ ADINA GÖRE AKILLI YAPILANDIRMA ====================

  private buildCategoryConfig(category: { id: string; name: string }): CategoryVariantConfig {
    const name = category.name.toLowerCase();

    // Kategori adına göre variantRequired belirle (keyword analizi)
    const hasTrueKeyword = CATEGORY_VARIANT_REQUIRED_TRUE_KEYWORDS.some(k => name.includes(k));
    const hasFalseKeyword = CATEGORY_VARIANT_REQUIRED_FALSE_KEYWORDS.some(k => name.includes(k));

    if (hasFalseKeyword && !hasTrueKeyword) {
      return {
        categoryId: category.id,
        categoryName: category.name,
        variantRequired: false,
        requiredVariantTypes: [],
        allowNoVariant: true,
        allowSingleVariant: true,
        minimumVariantCount: 0,
        maximumVariantCount: 0,
        supportedVariantTypes: [],
      };
    }

    // Kategori adına göre akıllı tespit
    const requiresVariant = CATEGORY_VARIANT_REQUIRED_TRUE_KEYWORDS.some(k => name.includes(k));
    const noVariant = CATEGORY_VARIANT_REQUIRED_FALSE_KEYWORDS.some(k => name.includes(k));

    if (noVariant && !requiresVariant) {
      return {
        categoryId: category.id,
        categoryName: category.name,
        variantRequired: false,
        requiredVariantTypes: [],
        allowNoVariant: true,
        allowSingleVariant: true,
        minimumVariantCount: 0,
        maximumVariantCount: 0,
        supportedVariantTypes: [],
      };
    }

    if (requiresVariant) {
      return {
        categoryId: category.id,
        categoryName: category.name,
        variantRequired: true,
        requiredVariantTypes: ['RENK', 'BEDEN', 'NUMARA'],
        allowNoVariant: false,
        allowSingleVariant: true,
        minimumVariantCount: 1,
        maximumVariantCount: 10,
        supportedVariantTypes: ['RENK', 'BEDEN', 'NUMARA'],
      };
    }

    // Varsayılan: true ancak desteklenen tipler boş (AI karar versin)
    return {
      categoryId: category.id,
      categoryName: category.name,
      variantRequired: true,
      requiredVariantTypes: [],
      allowNoVariant: true,
      allowSingleVariant: true,
      minimumVariantCount: 0,
      maximumVariantCount: 5,
      supportedVariantTypes: ['RENK', 'BEDEN', 'NUMARA', 'HACIM', 'UZUNLUK', 'AGIRLIK'],
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const categoryEngine = new CategoryEngine();
