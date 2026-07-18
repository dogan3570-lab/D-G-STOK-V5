// ==================== PRICE ENGINE V1.0 ====================
// Auto Recalculation Engine - Step 5
// Sadece fiyat ile ilgili alanlari gunceller.
// =======================================================

import { prisma } from '../../../db/prisma.ts';

export class PriceEngine {
  /**
   * Tek bir urunun fiyat durumunu kontrol eder
   * KURAL: Sadece price alanlarini degistirir
   */
  static async recalculate(productId: string): Promise<{ changed: boolean }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, salePrice: true, vatRate: true, profitMargin: true },
    });

    if (!product) return { changed: false };
    return { changed: false };
  }
}
