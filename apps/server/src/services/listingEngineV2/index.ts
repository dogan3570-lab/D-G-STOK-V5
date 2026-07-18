import { prisma } from '../../db/prisma.ts';
import type { PriceRule, PriceCalculation, ListingResult } from './types.ts';
import { findBestRule, calculateProductPrice } from './ruleEngine.ts';
import { calculatePrice, previewPrice } from './priceEngine.ts';

// Kural CRUD
export async function createRule(data: Partial<PriceRule>) {
  // HATA 3 DÜZELTİLDİ: Zorunlu alan validasyonu
  if (!data.marketplaceId) {
    throw Object.assign(new Error('marketplaceId alanı zorunludur'), { statusCode: 400 });
  }
  return prisma.marketplacePricingRule.create({ data: data as any });
}

export async function updateRule(id: string, data: Partial<PriceRule>) {
  // HATA 4 DÜZELTİLDİ: Kayıt var mı kontrolü
  const existing = await prisma.marketplacePricingRule.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error(`Rule ${id} bulunamadı`), { statusCode: 404 });
  }
  return prisma.marketplacePricingRule.update({ where: { id }, data: data as any });
}

export async function deleteRule(id: string) {
  // HATA 5 DÜZELTİLDİ: Kayıt var mı kontrolü
  const existing = await prisma.marketplacePricingRule.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error(`Rule ${id} bulunamadı`), { statusCode: 404 });
  }
  return prisma.marketplacePricingRule.delete({ where: { id } });
}

export async function getRules(marketplaceId?: string) {
  const where: any = {};
  if (marketplaceId) where.marketplaceId = marketplaceId;
  return prisma.marketplacePricingRule.findMany({ where, orderBy: { priority: 'asc' } });
}

// Fiyat hesaplama
export { calculatePrice, previewPrice };

// Tek ürün fiyatı - HİÇBİR ZAMAN 404 dönmez, her durumda PriceCalculation döndürür
export async function getProductPrice(productId: string, marketplaceId: string): Promise<PriceCalculation> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, purchasePrice: true, vatRate: true, categoryId: true },
  });

  // HATA 7 DÜZELTİLDİ: Ürün bulunamasa bile default PriceCalculation döndür
  if (!product || !product.purchasePrice) {
    return {
      purchasePrice: 0,
      vatRate: 20,
      vatIncludedPrice: 0,
      profitMargin: 0,
      calculatedPrice: 0,
      roundedPrice: 0,
      rounding: 'none',
      rule: null,
      ruleType: 'NONE',
    };
  }

  const vatRate = product.vatRate ?? 20;
  const { rule, ruleType } = await findBestRule(product.id, product.categoryId, marketplaceId);

  if (!rule) {
    return {
      purchasePrice: product.purchasePrice,
      vatRate,
      vatIncludedPrice: 0,
      profitMargin: 0,
      calculatedPrice: product.purchasePrice,
      roundedPrice: product.purchasePrice,
      rounding: 'none',
      rule: null,
      ruleType: 'NONE',
    };
  }

  const calc = calculatePrice(product.purchasePrice, vatRate, rule);
  calc.ruleType = ruleType;
  return calc;
}

// Toplu listeleme
export async function bulkList(marketplaceId: string, productIds: string[]): Promise<{
  results: ListingResult[];
  successCount: number;
  errorCount: number;
}> {
  const results: ListingResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const productId of productIds) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, title: true, purchasePrice: true, vatRate: true, categoryId: true },
      });

      if (!product || !product.purchasePrice) {
        results.push({ productId, productTitle: null, marketplaceId, calculation: null as any, status: 'ERROR', errorMessage: 'Ürün bulunamadı veya alış fiyatı yok' });
        errorCount++;
        continue;
      }

      const vatRate = product.vatRate ?? 20;
      // HATA 2 DÜZELTİLDİ: Dinamik import yerine statik import kullanılıyor
      const calc = await calculateProductPrice(product.id, product.purchasePrice, vatRate, product.categoryId, marketplaceId);

      await prisma.listingLog.create({
        data: {
          productId,
          marketplaceId,
          ruleId: calc.rule?.id ?? null,
          ruleType: calc.ruleType,
          purchasePrice: calc.purchasePrice,
          vatIncludedPrice: calc.vatIncludedPrice,
          profitMargin: calc.profitMargin,
          rounding: calc.rounding,
          calculatedPrice: calc.roundedPrice,
          status: 'SUCCESS',
        },
      });

      results.push({ productId, productTitle: product.title, marketplaceId, calculation: calc, status: 'SUCCESS' });
      successCount++;
    } catch (err) {
      results.push({ productId, productTitle: null, marketplaceId, calculation: null as any, status: 'ERROR', errorMessage: String(err) });
      errorCount++;
    }
  }

  return { results, successCount, errorCount };
}

export async function getListingLogs(marketplaceId?: string, limit = 100) {
  const where: any = {};
  if (marketplaceId) where.marketplaceId = marketplaceId;
  return prisma.listingLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
