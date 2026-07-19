// ==================== SALES PREDICTION V1 ====================
// 30/60/90 günlük satış, ciro, kar ve stok bitiş tahmini
// ============================================================

import { prisma } from '../../db/prisma.ts';
import type { SalesPrediction as SalesPredictionType, SalesMetrics } from './types.ts';

export class SalesPredictionEngine {
  /**
   * Satış tahmini oluştur
   */
  async predict(productId: string, metrics?: SalesMetrics): Promise<SalesPredictionType> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true, salePrice: true },
    });

    if (!product) {
      return this.getDefaultPrediction();
    }

    // Son 30 gün sipariş sayısı
    const orderCount = await prisma.order.count({
      where: {
        items: { contains: productId },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    const dailySalesRate = orderCount / 30;
    const price = product.salePrice || 0;
    const stock = product.stock || 0;

    // Mevsimsellik ve trend faktörleri (gerçek implementasyonda ML modeli)
    const seasonalityFactor = 1.0;
    const trendFactor = 1.0;

    // 30 gün tahmini
    const estimated30Sales = Math.round(dailySalesRate * 30 * seasonalityFactor * trendFactor);
    const estimated30Revenue = Math.round(estimated30Sales * price);
    const estimated30Profit = Math.round(estimated30Revenue * 0.2); // %20 kar varsayımı

    // 60 gün tahmini
    const estimated60Sales = Math.round(dailySalesRate * 60 * seasonalityFactor * trendFactor);
    const estimated60Revenue = Math.round(estimated60Sales * price);
    const estimated60Profit = Math.round(estimated60Revenue * 0.2);

    // 90 gün tahmini
    const estimated90Sales = Math.round(dailySalesRate * 90 * seasonalityFactor * trendFactor * 0.95); // hafif düşüş
    const estimated90Revenue = Math.round(estimated90Sales * price);
    const estimated90Profit = Math.round(estimated90Revenue * 0.2);

    // Stok bitiş tarihi
    let stockEndDate: string | null = null;
    if (dailySalesRate > 0 && stock > 0) {
      const daysUntilStockEnd = Math.round(stock / dailySalesRate);
      if (daysUntilStockEnd < 365) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + daysUntilStockEnd);
        stockEndDate = endDate.toISOString();
      }
    }

    // Tahmin güveni
    const confidence = Math.min(90, Math.round(30 + orderCount * 2));

    return {
      next30Days: {
        estimatedSales: Math.max(0, estimated30Sales),
        estimatedRevenue: Math.max(0, estimated30Revenue),
        estimatedProfit: Math.max(0, estimated30Profit),
      },
      next60Days: {
        estimatedSales: Math.max(0, estimated60Sales),
        estimatedRevenue: Math.max(0, estimated60Revenue),
        estimatedProfit: Math.max(0, estimated60Profit),
      },
      next90Days: {
        estimatedSales: Math.max(0, estimated90Sales),
        estimatedRevenue: Math.max(0, estimated90Revenue),
        estimatedProfit: Math.max(0, estimated90Profit),
      },
      stockEndDate,
      confidence,
    };
  }

  private getDefaultPrediction(): SalesPredictionType {
    return {
      next30Days: { estimatedSales: 0, estimatedRevenue: 0, estimatedProfit: 0 },
      next60Days: { estimatedSales: 0, estimatedRevenue: 0, estimatedProfit: 0 },
      next90Days: { estimatedSales: 0, estimatedRevenue: 0, estimatedProfit: 0 },
      stockEndDate: null,
      confidence: 0,
    };
  }
}
