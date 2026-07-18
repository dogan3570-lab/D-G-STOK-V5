// ==================== TEMPLATE ENGINE V1.0 ====================
// Auto Recalculation Engine - Step 4
// Sadece templateMatch alanini gunceller.
// =======================================================

import { prisma } from '../../../db/prisma.ts';

export class TemplateEngine {
  /**
   * Tek bir urunun templateMatch durumunu gunceller
   * KURAL: Sadece templateMatch alanini degistirir
   */
  static async recalculate(productId: string): Promise<{ changed: boolean; templateMatch: boolean }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, categoryMatch: true, brandMatch: true, categoryId: true, templateMatch: true },
    });

    if (!product) return { changed: false, templateMatch: false };

    // Kategori + marka eslesmisse ve aktif sablon varsa templateMatch=true
    const hasActiveTemplate = await prisma.listingTemplate.count({ where: { active: true } }) > 0;
    const shouldBeTrue = product.categoryMatch && product.brandMatch && product.categoryId !== null && hasActiveTemplate;

    if (product.templateMatch !== shouldBeTrue) {
      await prisma.product.update({
        where: { id: productId },
        data: { templateMatch: shouldBeTrue },
      });
      return { changed: true, templateMatch: shouldBeTrue };
    }

    return { changed: false, templateMatch: product.templateMatch };
  }
}
