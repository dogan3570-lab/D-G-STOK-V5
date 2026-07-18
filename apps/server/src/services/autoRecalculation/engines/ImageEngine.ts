// ==================== IMAGE ENGINE V1.0 ====================
// Auto Recalculation Engine - Step 7
// Sadece images alanini kontrol eder.
// =======================================================

import { prisma } from '../../../db/prisma.ts';

export class ImageEngine {
  static async recalculate(productId: string): Promise<{ changed: boolean; hasImages: boolean }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, images: true },
    });
    if (!product) return { changed: false, hasImages: false };
    return { changed: false, hasImages: product.images !== null };
  }
}
