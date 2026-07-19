// ==================== MARGIN ENGINE V1 ====================
// Kar marjı hesaplama ve optimizasyon motoru
// ==========================================================

import type { MarketplaceKey, RiskLevel } from './types.ts';

interface MarginConfig {
  minMargin: number;
  targetMargin: number;
  maxMargin: number;
  marketplaceCommission: number;
  cargoCost: number;
  packagingCost: number;
  fixedCosts: number;
}

const MARKETPLACE_CONFIG: Record<string, MarginConfig> = {
  trendyol: { minMargin: 10, targetMargin: 25, maxMargin: 60, marketplaceCommission: 15, cargoCost: 29.90, packagingCost: 5, fixedCosts: 3.50 },
  hepsiburada: { minMargin: 8, targetMargin: 22, maxMargin: 55, marketplaceCommission: 12, cargoCost: 29.90, packagingCost: 5, fixedCosts: 3.50 },
  n11: { minMargin: 10, targetMargin: 25, maxMargin: 50, marketplaceCommission: 15, cargoCost: 29.90, packagingCost: 5, fixedCosts: 3.50 },
  amazon: { minMargin: 12, targetMargin: 28, maxMargin: 65, marketplaceCommission: 18, cargoCost: 34.90, packagingCost: 5, fixedCosts: 3.50 },
  pazarama: { minMargin: 8, targetMargin: 20, maxMargin: 45, marketplaceCommission: 10, cargoCost: 29.90, packagingCost: 5, fixedCosts: 3.50 },
  ciceksepeti: { minMargin: 8, targetMargin: 20, maxMargin: 45, marketplaceCommission: 10, cargoCost: 24.90, packagingCost: 5, fixedCosts: 3.50 },
};

export class MarginEngine {
  /**
   * Kar marjı analizi
   */
  analyze(purchasePrice: number, salePrice: number, marketplaceKey?: MarketplaceKey): {
    currentMargin: number;
    minMargin: number;
    targetMargin: number;
    maxMargin: number;
    marginStatus: 'LOW' | 'TARGET' | 'HIGH' | 'OVER_MAX';
    riskLevel: RiskLevel;
    suggestions: string[];
  } {
    const config = marketplaceKey ? MARKETPLACE_CONFIG[marketplaceKey] : MARKETPLACE_CONFIG.trendyol;
    const suggestions: string[] = [];

    const commissionAmount = salePrice * (config.marketplaceCommission / 100);
    const totalCost = purchasePrice + commissionAmount + config.cargoCost + config.packagingCost + config.fixedCosts;
    const profit = salePrice - totalCost;
    const currentMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    let marginStatus: 'LOW' | 'TARGET' | 'HIGH' | 'OVER_MAX';
    let riskLevel: RiskLevel;

    if (currentMargin < config.minMargin) {
      marginStatus = 'LOW';
      riskLevel = 'HIGH';
      suggestions.push(`Kar marjı çok düşük (%${currentMargin.toFixed(1)}). Minimum %${config.minMargin} olmalı.`);
      suggestions.push(`Fiyat en az ${this.calculateMinimumPrice(purchasePrice, config)} TL olmalı.`);
    } else if (currentMargin >= config.minMargin && currentMargin <= config.targetMargin) {
      marginStatus = 'TARGET';
      riskLevel = 'MEDIUM';
      if (currentMargin < config.targetMargin) {
        suggestions.push(`Kar marjı hedefin altında (%${currentMargin.toFixed(1)}). Hedef: %${config.targetMargin}.`);
      }
    } else if (currentMargin > config.targetMargin && currentMargin <= config.maxMargin) {
      marginStatus = 'HIGH';
      riskLevel = 'LOW';
      suggestions.push(`Kar marjı iyi seviyede (%${currentMargin.toFixed(1)}).`);
    } else {
      marginStatus = 'OVER_MAX';
      riskLevel = 'LOW';
      suggestions.push(`Kar marjı çok yüksek (%${currentMargin.toFixed(1)}). Rekabetçi fiyat için düşürülebilir.`);
    }

    return {
      currentMargin: Math.round(currentMargin * 100) / 100,
      minMargin: config.minMargin,
      targetMargin: config.targetMargin,
      maxMargin: config.maxMargin,
      marginStatus,
      riskLevel,
      suggestions,
    };
  }

  /**
   * Minimum fiyat hesapla
   */
  calculateMinimumPrice(purchasePrice: number, config: MarginConfig): number {
    const base = purchasePrice + config.cargoCost + config.packagingCost + config.fixedCosts;
    return Math.round((base / (1 - config.marketplaceCommission / 100)) * (1 + config.minMargin / 100) * 100) / 100;
  }

  /**
   * Hedef fiyat hesapla
   */
  calculateTargetPrice(purchasePrice: number, marketplaceKey?: MarketplaceKey): number {
    const config = marketplaceKey ? MARKETPLACE_CONFIG[marketplaceKey] : MARKETPLACE_CONFIG.trendyol;
    const base = purchasePrice + config.cargoCost + config.packagingCost + config.fixedCosts;
    return Math.round((base / (1 - config.marketplaceCommission / 100)) * (1 + config.targetMargin / 100) * 100) / 100;
  }

  static getMarketplaceConfig(marketplaceKey: string): MarginConfig | undefined {
    return MARKETPLACE_CONFIG[marketplaceKey];
  }

  static getAllConfigs(): Record<string, MarginConfig> {
    return MARKETPLACE_CONFIG;
  }
}
