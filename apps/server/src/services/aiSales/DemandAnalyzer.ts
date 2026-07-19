// ==================== DEMAND ANALYZER V1 ====================
// Talep analizi, satış hızı, iade oranı ve stok riski
// ============================================================

import { prisma } from '../../db/prisma.ts';
import type { RiskLevel, SalesMetrics } from './types.ts';

export class DemandAnalyzer {
  /**
   * Talep ve satış metriklerini analiz et
   */
  async analyze(productId: string, marketplaceKey?: string): Promise<SalesMetrics> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, salePrice: true, purchasePrice: true,
        stock: true, profitMargin: true,
        createdAt: true,
      },
    });

    if (!product) {
      return this.getDefaultMetrics();
    }

    const currentPrice = product.salePrice || 0;
    const buyPrice = product.purchasePrice || 0;
    const profit = currentPrice - buyPrice;
    const profitRate = buyPrice > 0 ? (profit / buyPrice) * 100 : 0;

    // Sipariş sayısı ve iade oranı (Prisma üzerinden)
    const orderCount = await prisma.order.count({
      where: {
        items: { contains: productId },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    const returnCount = 0; // Prisma'da iade takibi varsa eklenir

    // Satış hızı (velocity) - 30 gündeki sipariş sayısı
    const velocityScore = this.calculateVelocityScore(orderCount);

    // Talep skoru
    const demandScore = this.calculateDemandScore(orderCount, returnCount, profitRate);

    // Stok riski
    const stockRisk = this.calculateStockRisk(product.stock || 0, velocityScore);

    const returnRate = orderCount > 0 ? (returnCount / orderCount) * 100 : 0;

    return {
      currentPrice,
      buyPrice,
      profit: Math.round(profit * 100) / 100,
      profitRate: Math.round(profitRate * 100) / 100,
      competitionLevel: 50, // CompetitorAnalyzer'den gelir
      demandScore,
      velocityScore,
      stockRisk,
      stockQuantity: product.stock || 0,
      orderCount,
      returnRate: Math.round(returnRate * 100) / 100,
    };
  }

  private getDefaultMetrics(): SalesMetrics {
    return {
      currentPrice: 0, buyPrice: 0, profit: 0, profitRate: 0,
      competitionLevel: 50, demandScore: 50, velocityScore: 50,
      stockRisk: 'LOW', stockQuantity: 0, orderCount: 0, returnRate: 0,
    };
  }

  private calculateVelocityScore(orderCount: number): number {
    if (orderCount >= 100) return 90;
    if (orderCount >= 50) return 75;
    if (orderCount >= 20) return 60;
    if (orderCount >= 10) return 45;
    if (orderCount >= 5) return 30;
    if (orderCount >= 1) return 20;
    return 5;
  }

  private calculateDemandScore(orderCount: number, returnCount: number, profitRate: number): number {
    const orderFactor = Math.min(orderCount / 50, 1) * 40;
    const returnPenalty = returnCount > 0 ? (returnCount / Math.max(orderCount, 1)) * 30 : 0;
    const profitFactor = Math.min(Math.max(profitRate / 30, 0), 1) * 30;

    return Math.round(Math.max(0, Math.min(100, orderFactor + profitFactor - returnPenalty)));
  }

  private calculateStockRisk(stockQuantity: number, velocityScore: number): RiskLevel {
    if (stockQuantity <= 0) return 'CRITICAL';
    if (stockQuantity <= 5) return 'HIGH';
    if (stockQuantity <= 20 && velocityScore >= 60) return 'HIGH';
    if (stockQuantity <= 50) return 'MEDIUM';
    return 'LOW';
  }
}
