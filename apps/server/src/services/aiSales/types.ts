// ==================== AI SALES & PROFIT ADVISOR TYPES V1 ====================
// DG STOK V5.0 - AI Satış ve Karlılık Asistanı Tipleri
// ===========================================================================

export type MarketplaceKey = 'trendyol' | 'hepsiburada' | 'n11' | 'amazon' | 'pazarama' | 'ciceksepeti';

export type Recommendation = 'PRICE_UP' | 'PRICE_DOWN' | 'HOLD' | 'CAMPAIGN' | 'URGENT_PRICE_UP';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AIDecisionReason =
  | 'LOW_STOCK' | 'HIGH_DEMAND' | 'LOW_PROFIT' | 'HIGH_PROFIT'
  | 'COMPETITOR_LOW' | 'COMPETITOR_HIGH' | 'SLOW_SALES' | 'FAST_SALES'
  | 'HIGH_RETURN' | 'LOW_MARGIN' | 'STOCK_RISK' | 'CAMPAIGN_OPPORTUNITY';

export interface SalesAnalysisConfig {
  marketplaceKey?: MarketplaceKey;
  categoryId?: string;
  brandId?: string;
}

export interface ProfitBreakdown {
  grossProfit: number;
  grossProfitRate: number;
  commissionAfter: number;
  commissionAfterRate: number;
  taxAfter: number;
  taxAfterRate: number;
  cargoAfter: number;
  cargoAfterRate: number;
  packagingAfter: number;
  packagingAfterRate: number;
  realProfit: number;
  realProfitRate: number;
}

export interface SalesMetrics {
  currentPrice: number;
  buyPrice: number;
  profit: number;
  profitRate: number;
  competitionLevel: number; // 0-100
  demandScore: number; // 0-100
  velocityScore: number; // 0-100
  stockRisk: RiskLevel;
  stockQuantity: number;
  orderCount: number;
  returnRate: number; // 0-100
}

export interface PriceRecommendation {
  currentPrice: number;
  recommendedPrice: number;
  minimumPrice: number;
  maximumPrice: number;
  confidence: number; // 0-100
  reason: AIDecisionReason;
  reasonDetail: string;
  recommendation: Recommendation;
  riskLevel: RiskLevel;
  expectedSalesDrop: number; // % olarak beklenen satış düşüşü
  profitChange: number; // % olarak kar değişimi
}

export interface SalesReport {
  productId: string;
  marketplace: MarketplaceKey;
  buyPrice: number;
  currentPrice: number;
  recommendedPrice: number;
  minimumPrice: number;
  maximumPrice: number;
  profit: number;
  profitRate: number;
  competitionLevel: number;
  demandScore: number;
  velocityScore: number;
  stockRisk: string;
  recommendation: string;
  confidence: number;
  profitBreakdown: ProfitBreakdown;
  salesMetrics: SalesMetrics;
  prediction: SalesPrediction;
}

export interface SalesPrediction {
  next30Days: {
    estimatedSales: number;
    estimatedRevenue: number;
    estimatedProfit: number;
  };
  next60Days: {
    estimatedSales: number;
    estimatedRevenue: number;
    estimatedProfit: number;
  };
  next90Days: {
    estimatedSales: number;
    estimatedRevenue: number;
    estimatedProfit: number;
  };
  stockEndDate: string | null;
  confidence: number;
}

export interface CampaignSuggestion {
  type: string;
  description: string;
  expectedImpact: string;
  riskLevel: RiskLevel;
  confidence: number;
}

export interface CompetitorData {
  competitorPrice: number;
  competitorName: string;
  priceDifference: number;
  priceDifferencePercent: number;
}

export interface MarketPerformance {
  marketplaceKey: MarketplaceKey;
  totalProducts: number;
  averagePrice: number;
  averageProfit: number;
  averageProfitRate: number;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  topSellers: number;
  slowMovers: number;
  highRisk: number;
}
