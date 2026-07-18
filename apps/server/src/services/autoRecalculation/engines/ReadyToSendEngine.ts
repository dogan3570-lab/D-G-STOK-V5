// ==================== READY TO SEND ENGINE V1.0 ====================
// Auto Recalculation Engine - Step 10
// Bir urunun Gonderime Hazir olup olmadigini hesaplar.
// Product.status alanini gunceller: READY | PASSIVE | ERROR
// ===============================================================

import { prisma } from '../../../db/prisma.ts';

export interface ReadinessResult {
  productId: string;
  isReady: boolean;
  score: number;
  checks: {
    categoryMatch: boolean;
    brandMatch: boolean;
    variantMatch: boolean;
    templateMatch: boolean;
    hasBarcode: boolean;
    hasPrice: boolean;
    hasStock: boolean;
    hasImages: boolean;
    hasDescription: boolean;
    hasTitle: boolean;
  };
}

export class ReadyToSendEngine {
  /**
   * Tek bir urunun gonderime hazir durumunu hesaplar
   * KURAL: Sadece product.status alanini gunceller
   */
  static async recalculate(productId: string): Promise<ReadinessResult> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, title: true, description: true, images: true,
        barcode: true, stock: true, salePrice: true, status: true,
        categoryMatch: true, brandMatch: true, variantMatch: true, templateMatch: true,
      },
    });

    if (!product) {
      return {
        productId, isReady: false, score: 0,
        checks: { categoryMatch: false, brandMatch: false, variantMatch: false, templateMatch: false, hasBarcode: false, hasPrice: false, hasStock: false, hasImages: false, hasDescription: false, hasTitle: false },
      };
    }

    // 10 kriter kontrolu (ReadyToSend UI ile AYNI mantik)
    const checks = {
      categoryMatch: product.categoryMatch,
      brandMatch: product.brandMatch,
      variantMatch: product.variantMatch,
      templateMatch: product.templateMatch,
      hasBarcode: product.barcode !== null,
      hasPrice: product.salePrice !== null && product.salePrice > 0,
      hasStock: product.stock > 0,
      hasImages: product.images !== null,
      hasDescription: product.description !== null && product.description.length > 0,
      hasTitle: product.title !== null && product.title.length > 5,
    };

    // Skor hesapla (ReadyToSend.tsx healthScore ile AYNI)
    let score = 0;
    if (checks.categoryMatch) score += 20;
    if (checks.brandMatch) score += 15;
    if (checks.variantMatch) score += 15;
    if (checks.templateMatch) score += 10;
    if (checks.hasBarcode) score += 10;
    if (checks.hasPrice) score += 10;
    if (checks.hasStock) score += 5;
    if (checks.hasTitle) score += 5;
    if (checks.hasImages) score += 5;
    if (checks.hasDescription) score += 5;

    // Yeni status belirle
    const isReady = score >= 80;
    const newStatus = isReady ? 'READY' : score >= 50 ? 'PENDING' : 'ERROR';

    // Sadece status degistiysse guncelle
    if (product.status !== newStatus) {
      await prisma.product.update({
        where: { id: productId },
        data: { status: newStatus },
      });
    }

    return { productId, isReady, score, checks };
  }
}
