// ==================== BARCODE ENGINE V1.0 ====================
// Auto Recalculation Engine - Step 6
// Sadece barcode alanini kontrol eder.
// =======================================================

import { prisma } from '../../../db/prisma.ts';

export class BarcodeEngine {
  static async recalculate(productId: string): Promise<{ changed: boolean; hasBarcode: boolean }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, barcode: true },
    });
    if (!product) return { changed: false, hasBarcode: false };
    return { changed: false, hasBarcode: product.barcode !== null };
  }
}
