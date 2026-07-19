// ==================== PRICE RECOMMENDATION V1 ====================
// AI fiyat öneri motoru - Pricing Engine verilerini kullanır
// ================================================================

import { PricingEngine } from '../priceEngine/PricingEngine.ts';
import { ProfitAnalyzer } from './ProfitAnalyzer.ts';
import { CompetitorAnalyzer } from './CompetitorAnalyzer.ts';
import { DemandAnalyzer } from './DemandAnalyzer.ts';
import { MarginEngine } from './MarginEngine.ts';
import { StockVelocityAnalyzer } from './StockVelocityAnalyzer.ts';
import type {
  PriceRecommendation, MarketplaceKey, RiskLevel,
  AIDecisionReason, Recommendation, SalesMetrics,
} from './types.ts';

export class PriceRecommendationEngine {
  private profitAnalyzer = new ProfitAnalyzer();
  private competitorAnalyzer = new CompetitorAnalyzer();
  private demandAnalyzer = new DemandAnalyzer();
  private marginEngine = new MarginEngine();
  private stockVelocity = new StockVelocityAnalyzer();

  /**
   * AI fiyat önerisi oluştur
   */
  async recommend(productId: string, marketplaceKey?: MarketplaceKey): Promise<PriceRecommendation> {
    const metrics = await this.demandAnalyzer.analyze(productId, marketplaceKey);

    const [calculation, profitBreakdown, competition, stockInfo, marginAnalysis] = await Promise.all([
      PricingEngine.calculate(productId, marketplaceKey),
      this.profitAnalyzer.analyze(productId, marketplaceKey),
      this.competitorAnalyzer.analyzeCompetition(productId, marketplaceKey),
      this.stockVelocity.analyze(productId),
      this.marginEngine.analyze(metrics.buyPrice, metrics.currentPrice, marketplaceKey),
    ]);

    const currentPrice = calculation.finalPrice;
    const buyPrice = calculation.purchasePrice;

    // AI Karar Mekanizması
    const decision = this.makeDecision({
      currentPrice,
      buyPrice,
      profit: metrics.profit,
      profitRate: metrics.profitRate,
      competitionLevel: competition.level,
      demandScore: metrics.demandScore,
      velocityScore: metrics.velocityScore,
      stockRisk: marginAnalysis.riskLevel,
      stockQuantity: metrics.stockQuantity,
      orderCount: metrics.orderCount,
      returnRate: metrics.returnRate,
      marginStatus: marginAnalysis.marginStatus,
      estimatedStockEndDays: stockInfo.estimatedStockEndDays,
      competitionAvg: competition.marketAverage,
      competitionMin: competition.marketRange.min,
      competitionMax: competition.marketRange.max,
    });

    return {
      currentPrice,
      recommendedPrice: decision.recommendedPrice,
      minimumPrice: calculation.minSalePrice || Math.round(buyPrice * 1.05),
      maximumPrice: calculation.maxSalePrice || Math.round(buyPrice * 3),
      confidence: decision.confidence,
      reason: decision.reason,
      reasonDetail: decision.reasonDetail,
      recommendation: decision.recommendation,
      riskLevel: decision.riskLevel,
      expectedSalesDrop: decision.expectedSalesDrop,
      profitChange: decision.profitChange,
    };
  }

  private makeDecision(context: {
    currentPrice: number;
    buyPrice: number;
    profit: number;
    profitRate: number;
    competitionLevel: number;
    demandScore: number;
    velocityScore: number;
    stockRisk: RiskLevel;
    stockQuantity: number;
    orderCount: number;
    returnRate: number;
    marginStatus: string;
    estimatedStockEndDays: number;
    competitionAvg: number;
    competitionMin: number;
    competitionMax: number;
  }): {
    recommendedPrice: number;
    confidence: number;
    reason: AIDecisionReason;
    reasonDetail: string;
    recommendation: Recommendation;
    riskLevel: RiskLevel;
    expectedSalesDrop: number;
    profitChange: number;
  } {
    const { currentPrice, buyPrice, profitRate, stockQuantity, velocityScore, estimatedStockEndDays, competitionAvg } = context;

    // Varsayılan: Bekle
    let recommendation: Recommendation = 'HOLD';
    let reason: AIDecisionReason = 'LOW_MARGIN';
    let reasonDetail = 'Fiyat şu an uygun seviyede.';
    let riskLevel: RiskLevel = 'LOW';
    let priceChangePercent = 0;
    let confidence = 75;
    let expectedSalesDrop = 0;

    // KRİTER 1: Stok kritik seviyede ve talep yüksek → Fiyat artır
    if (estimatedStockEndDays <= 7 && velocityScore >= 60) {
      priceChangePercent = 12;
      recommendation = 'URGENT_PRICE_UP';
      reason = 'LOW_STOCK';
      reasonDetail = `Stok ${estimatedStockEndDays} gün içinde bitecek. Fiyat %${priceChangePercent} artırılabilir.`;
      riskLevel = 'MEDIUM';
      confidence = 90;
      expectedSalesDrop = 3;
    }
    // KRİTER 2: Stok azalıyor, talep iyi → Fiyat artır
    else if (estimatedStockEndDays <= 30 && velocityScore >= 40) {
      priceChangePercent = 8;
      recommendation = 'PRICE_UP';
      reason = 'LOW_STOCK';
      reasonDetail = `Stok ${estimatedStockEndDays} günde tükenecek. Fiyat %${priceChangePercent} artırılabilir. Kar %${(profitRate + priceChangePercent).toFixed(0)} olur.`;
      riskLevel = 'MEDIUM';
      confidence = 85;
      expectedSalesDrop = 5;
    }
    // KRİTER 3: Kar marjı çok düşük → Fiyat artır
    else if (profitRate < 10) {
      priceChangePercent = 15;
      recommendation = 'PRICE_UP';
      reason = 'LOW_PROFIT';
      reasonDetail = `Kar marjı çok düşük (%${profitRate.toFixed(1)}). Fiyat %${priceChangePercent} artırılırsa kar %${(profitRate + priceChangePercent).toFixed(0)} olur.`;
      riskLevel = 'HIGH';
      confidence = 80;
      expectedSalesDrop = 10;
    }
    // KRİTER 4: Satış hızı çok düşük, stok fazla → Fiyat düşür
    else if (velocityScore < 20 && stockQuantity > 50) {
      priceChangePercent = -8;
      recommendation = 'PRICE_DOWN';
      reason = 'SLOW_SALES';
      reasonDetail = `Satış hızı çok düşük. Fiyat %${Math.abs(priceChangePercent)} düşürülürse satışlar artabilir.`;
      riskLevel = 'MEDIUM';
      confidence = 70;
      expectedSalesDrop = -15; // satış artışı beklenir
    }
    // KRİTER 5: Rakip fiyatları çok düşük → Fiyat düşür
    else if (competitionAvg > 0 && currentPrice > competitionAvg * 1.1) {
      priceChangePercent = -5;
      recommendation = 'PRICE_DOWN';
      reason = 'COMPETITOR_LOW';
      reasonDetail = `Rakipler ortalama ${competitionAvg.toFixed(0)} TL'den satıyor. Fiyat rekabetçi hale getirilmeli.`;
      riskLevel = 'MEDIUM';
      confidence = 75;
      expectedSalesDrop = -8;
    }
    // KRİTER 6: Kar marjı çok yüksek, rekabet avantajı → Fiyat düşür
    else if (profitRate > 50 && competitionAvg > 0) {
      priceChangePercent = -10;
      recommendation = 'PRICE_DOWN';
      reason = 'HIGH_PROFIT';
      reasonDetail = `Kar marjı çok yüksek (%${profitRate.toFixed(0)}). Rekabetçi fiyat için düşürülebilir.`;
      riskLevel = 'LOW';
      confidence = 65;
      expectedSalesDrop = -5;
    }
    // KRİTER 7: Kampanya fırsatı
    else if (velocityScore < 30 && stockQuantity > 20) {
      recommendation = 'CAMPAIGN';
      reason = 'SLOW_SALES';
      reasonDetail = 'Kampanya ile satışlar canlandırılabilir.';
      riskLevel = 'LOW';
      confidence = 60;
      expectedSalesDrop = -20;
    }

    // Fiyat hesapla
    const recommendedPrice = currentPrice > 0
      ? Math.round(currentPrice * (1 + priceChangePercent / 100) / 100) * 100 - 1
      : buyPrice * 1.3;

    const profitChange = priceChangePercent;

    return {
      recommendedPrice: Math.max(recommendedPrice, buyPrice * 1.05),
      confidence,
      reason,
      reasonDetail,
      recommendation,
      riskLevel,
      expectedSalesDrop,
      profitChange,
    };
  }
}
