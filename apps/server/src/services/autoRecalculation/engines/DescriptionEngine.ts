// ==================== DESCRIPTION ENGINE V1.0 ====================
// Auto Recalculation Engine - Step 8
// Sadece description alanini kontrol eder.
// =======================================================

import { prisma } from '../../../db/prisma.ts';

export class DescriptionEngine {
  static async recalculate(productId: string): Promise<{ changed: boolean; hasDescription: boolean }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, description: true },
    });
    if (!product) return { changed: false, hasDescription: false };
    return { changed: false, hasDescription: product.description !== null && product.description.length > 0 };
  }
}
