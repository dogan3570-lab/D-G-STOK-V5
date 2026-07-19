// ==================== CAMPAIGN ADVISOR V1 ====================
// Kampanya önerileri ve fırsat analizi
// ============================================================

import { prisma } from '../../db/prisma.ts';
import type { CampaignSuggestion, RiskLevel, MarketplaceKey } from './types.ts';

export class CampaignAdvisor {
  /**
   * Kampanya önerileri üret
   */
  async suggest(productId: string, marketplaceKey?: MarketplaceKey): Promise<CampaignSuggestion[]> {
    const suggestions: CampaignSuggestion[] = [];

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true, salePrice: true, purchasePrice: true },
    });

    if (!product) return suggestions;

    // Stok fazlası kampanyası
    if (product.stock && product.stock > 100) {
      suggestions.push({
        type: 'STOCK_CLEARANCE',
        description: 'Stok fazlası için indirim kampanyası önerilir.',
        expectedImpact: 'Stok eritme ve nakit akışı',
        riskLevel: 'LOW',
        confidence: 75,
      });
    }

    // Düşük satışlı ürünler için kampanya
    const orderCount = await prisma.order.count({
      where: {
        items: { contains: productId },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    if (orderCount < 5 && product.stock && product.stock > 10) {
      suggestions.push({
        type: 'SALES_BOOST',
        description: 'Satışı düşük ürün için %10-15 indirimli kampanya.',
        expectedImpact: 'Satış hacminde %30-50 artış',
        riskLevel: 'MEDIUM',
        confidence: 65,
      });
    }

    // Yeni ürün kampanyası
    const daysSinceCreation = Math.floor((Date.now() - new Date(product.id).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCreation < 30) {
      suggestions.push({
        type: 'NEW_PRODUCT',
        description: 'Yeni ürün lansman kampanyası. İlk 30 gün %5 indirim.',
        expectedImpact: 'Hızlı müşteri edinme ve görünürlük',
        riskLevel: 'LOW',
        confidence: 80,
      });
    }

    // Pazaryeri bazlı özel kampanyalar
    if (marketplaceKey === 'trendyol') {
      suggestions.push({
        type: 'TRENDYOL_CAMPAIGN',
        description: 'Trendyol indirim günlerine katılım önerilir.',
        expectedImpact: 'Platform görünürlüğü ve satış artışı',
        riskLevel: 'LOW',
        confidence: 70,
      });
    }

    if (marketplaceKey === 'hepsiburada') {
      suggestions.push({
        type: 'HB_CAMPAIGN',
        description: 'Hepsiburada Hepsifırsat kampanyasına katılım.',
        expectedImpact: 'Özel kategoride görünürlük',
        riskLevel: 'LOW',
        confidence: 65,
      });
    }

    return suggestions;
  }

  /**
   * En iyi kampanya stratejisini belirle
   */
  async recommendBestStrategy(productId: string): Promise<{
    strategy: string;
    discountRate: number;
    duration: number;
    expectedROI: number;
  }> {
    const suggestions = await this.suggest(productId);

    if (suggestions.length === 0) {
      return {
        strategy: 'HOLD',
        discountRate: 0,
        duration: 0,
        expectedROI: 0,
      };
    }

    // İlk öneriyi en iyi strateji olarak kabul et
    const best = suggestions[0];
    const discountMap: Record<string, number> = {
      STOCK_CLEARANCE: 20,
      SALES_BOOST: 12,
      NEW_PRODUCT: 5,
      TRENDYOL_CAMPAIGN: 10,
      HB_CAMPAIGN: 10,
    };

    return {
      strategy: best.type,
      discountRate: discountMap[best.type] || 10,
      duration: 7, // gün
      expectedROI: 15, // %
    };
  }
}
