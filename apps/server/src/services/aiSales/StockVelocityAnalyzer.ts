// ==================== STOCK VELOCITY ANALYZER V1 ====================
// Stok hızı, stok bitiş tahmini ve stok risk analizi
// ====================================================================

import { prisma } from '../../db/prisma.ts';
import type { RiskLevel } from './types.ts';

export class StockVelocityAnalyzer {
  /**
   * Stok hızı analizi
   */
  async analyze(productId: string): Promise<{
    velocity: number; // 0-100
    dailySalesRate: number;
    estimatedStockEndDays: number;
    stockRisk: RiskLevel;
    recommendation: string;
  }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true, createdAt: true },
    });

    if (!product || !product.stock || product.stock <= 0) {
      return {
        velocity: 0,
        dailySalesRate: 0,
        estimatedStockEndDays: 0,
        stockRisk: 'CRITICAL',
        recommendation: 'Stok tükenmiş veya ürün bulunamadı.',
      };
    }

    // Son 30 günlük sipariş sayısı
    const last30DaysOrders = await prisma.order.count({
      where: {
        items: { contains: productId },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    const dailySalesRate = last30DaysOrders / 30;
    const estimatedStockEndDays = dailySalesRate > 0 ? Math.round(product.stock / dailySalesRate) : 999;

    let velocity: number;
    if (dailySalesRate >= 10) velocity = 95;
    else if (dailySalesRate >= 5) velocity = 80;
    else if (dailySalesRate >= 2) velocity = 60;
    else if (dailySalesRate >= 1) velocity = 40;
    else if (dailySalesRate >= 0.5) velocity = 20;
    else velocity = 5;

    let stockRisk: RiskLevel;
    let recommendation: string;

    if (product.stock <= 0) {
      stockRisk = 'CRITICAL';
      recommendation = 'Stok tükendi! Acilen stok girişi yapılmalı.';
    } else if (estimatedStockEndDays <= 7) {
      stockRisk = 'CRITICAL';
      recommendation = `Stok ${estimatedStockEndDays} gün içinde bitecek. Fiyat %8-15 artırılabilir.`;
    } else if (estimatedStockEndDays <= 30) {
      stockRisk = 'HIGH';
      recommendation = `Stok ${estimatedStockEndDays} gün içinde bitecek. Fiyat %5-10 artırılabilir.`;
    } else if (estimatedStockEndDays <= 60) {
      stockRisk = 'MEDIUM';
      recommendation = `Stok ${estimatedStockEndDays} günde tükenecek. Normal seyir.`;
    } else if (dailySalesRate < 0.5 && product.stock > 100) {
      stockRisk = 'MEDIUM';
      recommendation = 'Satış hızı çok düşük. Fiyat düşürme veya kampanya önerilir.';
    } else {
      stockRisk = 'LOW';
      recommendation = 'Stok durumu sağlıklı.';
    }

    return {
      velocity,
      dailySalesRate: Math.round(dailySalesRate * 100) / 100,
      estimatedStockEndDays,
      stockRisk,
      recommendation,
    };
  }

  /**
   * Stok bitiş tarihi tahmini
   */
  async estimateStockEndDate(productId: string): Promise<Date | null> {
    const info = await this.analyze(productId);
    if (info.estimatedStockEndDays >= 999) return null;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + info.estimatedStockEndDays);
    return endDate;
  }
}
