// ==================== YARDIMCI FONKSİYONLAR V5.0 ====================
// DG STOK V5.0 - Ortak yardımcı fonksiyonlar
// =====================================================================

import type { V5Product } from './types.ts';

export function toV5Product(prismaProduct: any): V5Product {
  return {
    id: prismaProduct.id,
    xmlKey: prismaProduct.xmlKey,
    title: prismaProduct.title ?? null,
    originalTitle: prismaProduct.originalTitle ?? null,
    sku: prismaProduct.sku ?? null,
    barcode: prismaProduct.barcode ?? null,
    stock: prismaProduct.stock ?? 0,
    salePrice: prismaProduct.salePrice ?? null,
    purchasePrice: prismaProduct.purchasePrice ?? null,
    description: prismaProduct.description ?? null,
    supplierCategory: prismaProduct.supplierCategory ?? null,
    images: prismaProduct.images ?? null,
    categoryId: prismaProduct.categoryId ?? null,
    brandId: prismaProduct.brandId ?? null,
    xmlSourceId: prismaProduct.xmlSourceId ?? null,
    variantStatus: prismaProduct.variantStatus ?? 'WAITING_AI',
    category: prismaProduct.category ?? null,
    brand: prismaProduct.brand ?? null,
    xmlSource: prismaProduct.xmlSource ?? null,
    variants: (prismaProduct.variants ?? []).map((v: any) => ({
      id: v.id,
      name: v.name,
      value: v.value,
    })),
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
