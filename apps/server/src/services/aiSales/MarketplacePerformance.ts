// ==================== MARKETPLACE PERFORMANCE V1 ====================
// Pazaryeri bazlı satış ve kar performans analizi
// ====================================================================

import { prisma } from '../../db/prisma.ts';
import type { MarketplaceKey, MarketPerformance, SalesMetrics } from './types.ts';
import { DemandAnalyzer } from './DemandAnalyzer.ts';
import { MarginEngine } from './MarginEngine.ts';

export class MarketplacePerformanceAnalyzer {
  private demandAnalyzer = new DemandAnalyzer();
  private marginEngine = new MarginEngine();

  /**
   * Tüm pazaryerleri için performans analizi
   */
  async analyzeAll(productId: string): Promise<Record<string, MarketPerformance>> {
    const marketplaces = ['trendyol', 'hepsiburada', 'n11', 'amazon', 'pazarama', 'ciceksepeti'];
    const results: Record<string, MarketPerformance> = {};

    for (const key of marketplaces) {
      results[key] = await this.analyzeMarketplace(productId, key as MarketplaceKey);
    }

    return results;
  }

  /**
   * Tek pazaryeri performans analizi
   */
  async analyzeMarketplace(productId: string, marketplaceKey: MarketplaceKey): Promise<MarketPerformance> {
    const config = MarginEngine.getMarketplaceConfig(marketplaceKey);

    const metrics = await this.demandAnalyzer.analyze(productId, marketplaceKey);

    const topSellers = metrics.velocityScore >= 60 ? 1 : 0;
    const slowMovers = metrics.velocityScore < 20 ? 1 : 0;
    const highRisk = metrics.stockRisk === 'CRITICAL' || metrics.stockRisk === 'HIGH' ? 1 : 0;

    return {
      marketplaceKey,
      totalProducts: 1,
      averagePrice: metrics.currentPrice,
      averageProfit: metrics.profit,
      averageProfitRate: metrics.profitRate,
      totalSales: metrics.orderCount,
      totalRevenue: metrics.currentPrice * metrics.orderCount,
      totalProfit: metrics.profit * metrics.orderCount,
      topSellers,
      slowMovers,
      highRisk,
    };
  }

  /**
   * En iyi pazaryeri önerisi
   */
  async recommendBestMarketplace(productId: string): Promise<{
    marketplaceKey: MarketplaceKey;
    reason: string;
    expectedProfit: number;
  }> {
    const performances = await this.analyzeAll(productId);

    let bestKey: MarketplaceKey = 'trendyol';
    let bestProfit = -Infinity;

    for (const [key, perf] of Object.entries(performances)) {
      if (perf.averageProfit > bestProfit) {
        bestProfit = perf.averageProfit;
        bestKey = key as MarketplaceKey;
      }
    }

    const nameMap: Record<string, string> = {
      trendyol: 'Trendyol', hepsiburada: 'Hepsiburada', n11: 'N11',
      amazon: 'Amazon', pazarama: 'Pazarama', ciceksepeti: 'ÇiçekSepeti',
    };

    return {
      marketplaceKey: bestKey,
      reason: `En yüksek kar ${nameMap[bestKey]}'da elde ediliyor.`,
      expectedProfit: bestProfit,
    };
  }
}
