// ==================== AI SALES ADVISOR V1 ====================
// DG STOK V5.0 - AI Satış ve Karlılık Asistanı Ana Motoru
// Pricing Engine + AI Karar Mekanizması
// =============================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';
import { PricingEngine } from '../priceEngine/PricingEngine.ts';
import { ProfitAnalyzer } from './ProfitAnalyzer.ts';
import { CompetitorAnalyzer } from './CompetitorAnalyzer.ts';
import { DemandAnalyzer } from './DemandAnalyzer.ts';
import { MarginEngine } from './MarginEngine.ts';
import { StockVelocityAnalyzer } from './StockVelocityAnalyzer.ts';
import { MarketplacePerformanceAnalyzer } from './MarketplacePerformance.ts';
import { PriceRecommendationEngine } from './PriceRecommendation.ts';
import { CampaignAdvisor } from './CampaignAdvisor.ts';
import { SalesPredictionEngine } from './SalesPrediction.ts';
import type {
  SalesReport, MarketplaceKey, SalesAnalysisConfig,
  PriceRecommendation, CampaignSuggestion, SalesPrediction,
  ProfitBreakdown, MarketPerformance,
} from './types.ts';

export class AISalesAdvisor {
  private profitAnalyzer = new ProfitAnalyzer();
  private competitorAnalyzer = new CompetitorAnalyzer();
  private demandAnalyzer = new DemandAnalyzer();
  private marginEngine = new MarginEngine();
  private stockVelocity = new StockVelocityAnalyzer();
  private marketplacePerformance = new MarketplacePerformanceAnalyzer();
  private priceRecommendation = new PriceRecommendationEngine();
  private campaignAdvisor = new CampaignAdvisor();
  private salesPrediction = new SalesPredictionEngine();

  /**
   * Tek ürün için tam AI satış analizi
   */
  async analyze(productId: string, marketplaceKey?: MarketplaceKey): Promise<SalesReport> {
    const metrics = await this.demandAnalyzer.analyze(productId, marketplaceKey);

    const [product, calculation, profitBreakdown, competition, stockInfo, priceRec, campaigns, prediction, marginAnalysis] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      PricingEngine.calculate(productId, marketplaceKey),
      this.profitAnalyzer.analyze(productId, marketplaceKey),
      this.competitorAnalyzer.analyzeCompetition(productId, marketplaceKey),
      this.stockVelocity.analyze(productId),
      this.priceRecommendation.recommend(productId, marketplaceKey),
      this.campaignAdvisor.suggest(productId, marketplaceKey),
      this.salesPrediction.predict(productId, metrics),
      this.marginEngine.analyze(metrics.buyPrice, metrics.currentPrice, marketplaceKey),
    ]);

    const mKey: MarketplaceKey = marketplaceKey || 'trendyol';

    // Veritabanına kaydet
    const report = await prisma.aISalesReport.create({
      data: {
        productId,
        marketplace: mKey,
        buyPrice: calculation.purchasePrice,
        currentPrice: calculation.finalPrice,
        recommendedPrice: priceRec.recommendedPrice,
        minimumPrice: priceRec.minimumPrice,
        maximumPrice: priceRec.maximumPrice,
        profit: profitBreakdown.realProfit,
        profitRate: profitBreakdown.realProfitRate,
        competitionLevel: competition.level,
        demandScore: metrics.demandScore,
        velocityScore: metrics.velocityScore,
        stockRisk: stockInfo.stockRisk,
        recommendation: priceRec.recommendation,
        confidence: priceRec.confidence,
      },
    });

    // EventBus: Fiyat önerisi oluşturuldu
    await EventBus.emit({
      type: 'PriceRecommendationCreated',
      correlationId: createCorrelationId('AI'),
      timestamp: new Date().toISOString(),
      source: 'AISalesAdvisor',
      data: {
        productId,
        marketplace: mKey,
        currentPrice: calculation.finalPrice,
        recommendedPrice: priceRec.recommendedPrice,
        recommendation: priceRec.recommendation,
        confidence: priceRec.confidence,
        reportId: report.id,
      },
    });

    // Kar değişimi event'i
    const profitDiff = priceRec.recommendedPrice - calculation.finalPrice;
    if (Math.abs(profitDiff) > 0) {
      await EventBus.emit({
        type: 'ProfitChanged',
        correlationId: createCorrelationId('AI'),
        timestamp: new Date().toISOString(),
        source: 'AISalesAdvisor',
        data: {
          productId,
          marketplace: mKey,
          oldPrice: calculation.finalPrice,
          newPrice: priceRec.recommendedPrice,
          oldProfit: profitBreakdown.realProfit,
          newProfit: profitBreakdown.realProfit + profitDiff,
          reason: priceRec.reason,
        },
      });
    }

    // AI Command Center'a kaydet
    await this.syncToAICommandCenter(productId, priceRec, mKey);

    // Workflow güncelle
    await this.updateWorkflow(productId, priceRec);

    return {
      productId,
      marketplace: mKey,
      buyPrice: calculation.purchasePrice,
      currentPrice: calculation.finalPrice,
      recommendedPrice: priceRec.recommendedPrice,
      minimumPrice: priceRec.minimumPrice,
      maximumPrice: priceRec.maximumPrice,
      profit: profitBreakdown.realProfit,
      profitRate: profitBreakdown.realProfitRate,
      competitionLevel: competition.level,
      demandScore: metrics.demandScore,
      velocityScore: metrics.velocityScore,
      stockRisk: stockInfo.stockRisk,
      recommendation: priceRec.recommendation,
      confidence: priceRec.confidence,
      profitBreakdown,
      salesMetrics: metrics,
      prediction,
    };
  }

  /**
   * Toplu analiz
   */
  async bulkAnalyze(productIds: string[], marketplaceKey?: MarketplaceKey): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    results: Array<{
      productId: string;
      recommendation: string;
      currentPrice: number;
      recommendedPrice: number;
      confidence: number;
    }>;
  }> {
    const result = {
      totalProcessed: productIds.length,
      successful: 0,
      failed: 0,
      results: [] as Array<{
        productId: string;
        recommendation: string;
        currentPrice: number;
        recommendedPrice: number;
        confidence: number;
      }>,
    };

    const BATCH_SIZE = 10;
    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      const batch = productIds.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (productId) => {
        try {
          const report = await this.analyze(productId, marketplaceKey);
          result.successful++;
          result.results.push({
            productId,
            recommendation: report.recommendation,
            currentPrice: report.currentPrice,
            recommendedPrice: report.recommendedPrice,
            confidence: report.confidence,
          });
        } catch {
          result.failed++;
        }
      });
      await Promise.allSettled(promises);
    }

    return result;
  }

  /**
   * Belirli sayıda ürünü analiz et
   */
  async analyzeByCount(count: number, marketplaceKey?: MarketplaceKey): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    results: Array<{ productId: string; recommendation: string; currentPrice: number; recommendedPrice: number; confidence: number }>;
  }> {
    const validCounts = [100, 500, 1000, 5000];
    if (!validCounts.includes(count)) {
      throw new Error(`Geçersiz sayı: ${count}. Geçerli değerler: ${validCounts.join(', ')}`);
    }

    const products = await prisma.product.findMany({
      where: {
        salePrice: { gt: 0 },
        purchasePrice: { gt: 0 },
      },
      take: count,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    return this.bulkAnalyze(products.map(p => p.id), marketplaceKey);
  }

  /**
   * Dashboard istatistikleri
   */
  async getDashboardStats(): Promise<{
    todayRecommendations: number;
    totalAnalyzed: number;
    profitUp: number;
    profitDown: number;
    riskCount: number;
    opportunityCount: number;
    stockRiskCount: number;
    campaignSuggestions: number;
    byMarketplace: Record<string, number>;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalAnalyzed, todayRecs, profitUp, profitDown, riskCount, stockRiskCount, byMarketplace] = await Promise.all([
      prisma.aISalesReport.count(),
      prisma.aISalesReport.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.aISalesReport.count({ where: { recommendedPrice: { gt: 0 }, recommendation: { in: ['PRICE_UP', 'URGENT_PRICE_UP'] } } }),
      prisma.aISalesReport.count({ where: { recommendedPrice: { gt: 0 }, recommendation: { in: ['PRICE_DOWN'] } } }),
      prisma.aISalesReport.count({ where: { stockRisk: { in: ['HIGH', 'CRITICAL'] } } }),
      prisma.aISalesReport.count({ where: { stockRisk: { in: ['HIGH', 'CRITICAL'] } } }),
      prisma.aISalesReport.groupBy({ by: ['marketplace'], _count: true }),
    ]);

    const byMarketplaceMap: Record<string, number> = {};
    for (const item of byMarketplace) {
      byMarketplaceMap[item.marketplace] = item._count;
    }

    return {
      todayRecommendations: todayRecs,
      totalAnalyzed,
      profitUp,
      profitDown,
      riskCount,
      opportunityCount: profitUp,
      stockRiskCount,
      campaignSuggestions: 0,
      byMarketplace: byMarketplaceMap,
    };
  }

  /**
   * Ürün raporu getir
   */
  async getProductReport(productId: string): Promise<{
    product: any;
    report: any;
    recommendations: PriceRecommendation[];
    campaigns: CampaignSuggestion[];
    prediction: SalesPrediction;
    profitBreakdown: ProfitBreakdown;
    marketPerformance: Record<string, MarketPerformance>;
  } | null> {
    const report = await prisma.aISalesReport.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });

    if (!report) return null;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, sku: true, salePrice: true, purchasePrice: true, stock: true },
    });

    const mKey = report.marketplace as MarketplaceKey;
    const [priceRec, campaigns, prediction, profitBreakdown, marketPerformance] = await Promise.all([
      this.priceRecommendation.recommend(productId, mKey),
      this.campaignAdvisor.suggest(productId, mKey),
      this.salesPrediction.predict(productId),
      this.profitAnalyzer.analyze(productId, mKey),
      this.marketplacePerformance.analyzeAll(productId),
    ]);

    return {
      product,
      report,
      recommendations: [priceRec],
      campaigns,
      prediction,
      profitBreakdown,
      marketPerformance,
    };
  }

  /**
   * Bekleyen öneriler
   */
  async getRecommendations(filters?: {
    marketplace?: string;
    risk?: string;
    recommendation?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters?.marketplace) where.marketplace = filters.marketplace;
    if (filters?.recommendation) where.recommendation = filters.recommendation;

    return prisma.aISalesReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Öneriyi onayla/reddet
   */
  async approveRecommendation(reportId: string, approved: boolean): Promise<void> {
    const report = await prisma.aISalesReport.findUnique({
      where: { id: reportId },
    });

    if (!report) throw new Error('Rapor bulunamadı');

    // Geçmişe kaydet
    await prisma.aIProfitHistory.create({
      data: {
        productId: report.productId,
        oldPrice: report.currentPrice,
        newPrice: approved ? report.recommendedPrice : report.currentPrice,
        oldProfit: report.profit,
        newProfit: approved ? report.profit * (report.recommendedPrice / report.currentPrice) : report.profit,
        reason: approved ? 'AI_ONAY' : 'AI_RED',
        approved,
      },
    });

    // EventBus
    await EventBus.emit({
      type: approved ? 'PriceRecommendationApproved' : 'PriceRecommendationRejected',
      correlationId: createCorrelationId('AI'),
      timestamp: new Date().toISOString(),
      source: 'AISalesAdvisor',
      data: {
        reportId,
        productId: report.productId,
        marketplace: report.marketplace,
        oldPrice: report.currentPrice,
        newPrice: report.recommendedPrice,
        approved,
      },
    });

    if (approved) {
      // Fiyatı güncelle
      await prisma.product.update({
        where: { id: report.productId },
        data: { salePrice: report.recommendedPrice },
      });

      // AuditLog
      await prisma.auditLog.create({
        data: {
          action: 'PRICE_UPDATE_AI',
          entity: 'Product',
          entityId: report.productId,
          details: JSON.stringify({
            oldPrice: report.currentPrice,
            newPrice: report.recommendedPrice,
            reason: report.recommendation,
            marketplace: report.marketplace,
          }),
          success: true,
        },
      });

      // Dashboard refresh
      await EventBus.emit({
        type: 'DashboardRefresh',
        correlationId: createCorrelationId('AI'),
        timestamp: new Date().toISOString(),
        source: 'AISalesAdvisor',
        data: { reason: 'price_updated', affectedProductIds: [report.productId] },
      });
    }
  }

  /**
   * AI Command Center entegrasyonu
   */
  private async syncToAICommandCenter(productId: string, rec: PriceRecommendation, marketplace: MarketplaceKey): Promise<void> {
    const issueTypeMap: Record<string, string> = {
      'PRICE_UP': 'LOW_PROFIT',
      'PRICE_DOWN': 'HIGH_PRICE',
      'URGENT_PRICE_UP': 'LOW_PROFIT',
      'CAMPAIGN': 'HIGH_PRICE',
    };

    const mappedType = issueTypeMap[rec.recommendation] || 'LOW_PROFIT';

    await prisma.aIIssue.create({
      data: {
        productId,
        module: 'pricing',
        type: mappedType,
        severity: rec.riskLevel === 'CRITICAL' ? 'CRITICAL' : rec.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
        priority: rec.riskLevel === 'CRITICAL' ? 1 : rec.riskLevel === 'HIGH' ? 2 : 3,
        confidence: rec.confidence,
        title: `${marketplace} - ${rec.recommendation}`,
        description: rec.reasonDetail,
        recommendedAction: `Fiyat ${rec.currentPrice > rec.recommendedPrice ? 'düşür' : 'artır'}: ${rec.currentPrice} TL → ${rec.recommendedPrice} TL`,
      },
    });
  }

  /**
   * Workflow entegrasyonu
   */
  private async updateWorkflow(productId: string, rec: PriceRecommendation): Promise<void> {
    const ws = await prisma.workflowState.findUnique({ where: { productId } });
    if (!ws) return;

    await prisma.workflowTimeline.create({
      data: {
        productId,
        event: 'AI_PRICE_RECOMMENDATION',
        details: JSON.stringify({
          currentPrice: rec.currentPrice,
          recommendedPrice: rec.recommendedPrice,
          recommendation: rec.recommendation,
          reason: rec.reason,
          confidence: rec.confidence,
          riskLevel: rec.riskLevel,
        }),
      },
    });
  }

  /**
   * Yeniden hesapla
   */
  async recalculate(productId: string, marketplaceKey?: MarketplaceKey): Promise<SalesReport> {
    return this.analyze(productId, marketplaceKey);
  }
}
