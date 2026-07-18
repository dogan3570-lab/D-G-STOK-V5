import { prisma } from '../../db/prisma.ts';
import type { PriceRule, PriceCalculation } from './types.ts';
import { calculatePrice } from './priceEngine.ts';

export async function findBestRule(
  productId: string,
  categoryId: string | null,
  marketplaceId: string
): Promise<{ rule: PriceRule | null; ruleType: 'PRODUCT' | 'CATEGORY' | 'GENERAL' | 'NONE' }> {
  // Öncelik sırası: 1. Ürün 2. Kategori 3. Genel
  const rules = await prisma.marketplacePricingRule.findMany({
    where: {
      marketplaceId,
      active: true,
      OR: [
        { productId },
        { categoryId: categoryId ?? undefined },
        { productId: null, categoryId: null },
      ],
    },
    orderBy: { priority: 'asc' },
  });

  for (const rule of rules) {
    if (rule.productId === productId) {
      return { rule: rule as PriceRule, ruleType: 'PRODUCT' };
    }
  }

  for (const rule of rules) {
    if (rule.categoryId && rule.categoryId === categoryId) {
      return { rule: rule as PriceRule, ruleType: 'CATEGORY' };
    }
  }

  for (const rule of rules) {
    if (!rule.productId && !rule.categoryId) {
      return { rule: rule as PriceRule, ruleType: 'GENERAL' };
    }
  }

  return { rule: null, ruleType: 'NONE' };
}

export async function findPriceRangeRule(
  rules: PriceRule[],
  purchasePrice: number
): Promise<PriceRule | null> {
  const sorted = [...rules].sort((a, b) => a.minPrice - b.minPrice);
  for (const rule of sorted) {
    if (purchasePrice >= rule.minPrice && (rule.maxPrice === 0 || purchasePrice <= rule.maxPrice)) {
      return rule;
    }
  }
  return null;
}

export async function calculateProductPrice(
  productId: string,
  purchasePrice: number,
  vatRate: number,
  categoryId: string | null,
  marketplaceId: string
): Promise<PriceCalculation> {
  const { rule, ruleType } = await findBestRule(productId, categoryId, marketplaceId);

  if (!rule) {
    return {
      purchasePrice,
      vatRate,
      vatIncludedPrice: 0,
      profitMargin: 0,
      calculatedPrice: purchasePrice,
      roundedPrice: purchasePrice,
      rounding: 'none',
      rule: null,
      ruleType: 'NONE',
    };
  }

  const calc = calculatePrice(purchasePrice, vatRate, rule);
  calc.ruleType = ruleType;
  return calc;
}
