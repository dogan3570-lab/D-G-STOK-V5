// ==================== DUPLICATE KONTROL V5 ====================
// Aynı ürünün tekrar eklenmesini engeller
// Kontrol sırası: Barkod -> Supplier Product Code -> SKU
// ==========================================================

import { prisma } from '../../db/prisma.ts';

export interface DuplicateResult {
  action: 'CREATE' | 'UPDATE' | 'IGNORE';
  existingId?: string;
  matchedBy?: 'barcode' | 'xmlKey' | 'sku';
}

export class DuplicateChecker {
  /**
   * Ürünün daha önce eklenip eklenmediğini kontrol eder
   */
  async check(product: { xmlKey?: string; barcode?: string | null; sku?: string | null }, sourceId: string): Promise<DuplicateResult> {
    // 1. Barkod ile kontrol
    if (product.barcode) {
      const existing = await prisma.product.findFirst({
        where: {
          barcode: product.barcode,
          xmlSourceId: sourceId,
        },
        select: { id: true },
      });
      if (existing) {
        return { action: 'UPDATE', existingId: existing.id, matchedBy: 'barcode' };
      }
    }

    // 2. xmlKey ile kontrol (supplier product code)
    if (product.xmlKey) {
      const existing = await prisma.product.findUnique({
        where: { xmlKey: product.xmlKey },
        select: { id: true },
      });
      if (existing) {
        return { action: 'UPDATE', existingId: existing.id, matchedBy: 'xmlKey' };
      }
    }

    // 3. SKU ile kontrol
    if (product.sku) {
      const existing = await prisma.product.findFirst({
        where: {
          sku: product.sku,
          xmlSourceId: sourceId,
        },
        select: { id: true },
      });
      if (existing) {
        return { action: 'UPDATE', existingId: existing.id, matchedBy: 'sku' };
      }
    }

    return { action: 'CREATE' };
  }
}
