// ==================== PROFIT ANALYZER V1 ====================
// Brüt kar, net kar, komisyon/vergi/kargo/paketleme sonrası gerçek kar analizi
// ============================================================

import { prisma } from '../../db/prisma.ts';
import { PricingEngine } from '../priceEngine/PricingEngine.ts';
import type { ProfitBreakdown, MarketplaceKey } from './types.ts';

export class ProfitAnalyzer {
  /**
   * Gerçek kar analizi - tüm maliyetler dahil
   */
  async analyze(productId: string, marketplaceKey?: MarketplaceKey): Promise<ProfitBreakdown> {
    const calculation = await PricingEngine.calculate(productId, marketplaceKey);

    const {
      purchasePrice, vatRate, commissionRate,
      cargoCost, packagingCost, fixedCost, categoryCost,
      profitMargin, finalPrice, profitAmount, profitPercent,
    } = calculation;

    // Brüt Kar = Satış - Alış
    const grossProfit = finalPrice - purchasePrice;
    const grossProfitRate = purchasePrice > 0 ? (grossProfit / purchasePrice) * 100 : 0;

    // Komisyon Sonrası
    const commissionAmount = finalPrice * (commissionRate / 100);
    const afterCommission = grossProfit - commissionAmount;
    const commissionAfterRate = purchasePrice > 0 ? (afterCommission / purchasePrice) * 100 : 0;

    // Vergi Sonrası (KDV dahil)
    const vatAmount = finalPrice * (vatRate / (100 + vatRate));
    const afterTax = afterCommission - vatAmount;
    const taxAfterRate = purchasePrice > 0 ? (afterTax / purchasePrice) * 100 : 0;

    // Kargo Sonrası
    const afterCargo = afterTax - cargoCost;
    const cargoAfterRate = purchasePrice > 0 ? (afterCargo / purchasePrice) * 100 : 0;

    // Paketleme Sonrası
    const afterPackaging = afterCargo - packagingCost;
    const packagingAfterRate = purchasePrice > 0 ? (afterPackaging / purchasePrice) * 100 : 0;

    // Gerçek Kar (tüm maliyetler düşüldükten sonra)
    const realProfit = afterPackaging - fixedCost - categoryCost;
    const realProfitRate = purchasePrice > 0 ? (realProfit / purchasePrice) * 100 : 0;

    return {
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossProfitRate: Math.round(grossProfitRate * 100) / 100,
      commissionAfter: Math.round(afterCommission * 100) / 100,
      commissionAfterRate: Math.round(commissionAfterRate * 100) / 100,
      taxAfter: Math.round(afterTax * 100) / 100,
      taxAfterRate: Math.round(taxAfterRate * 100) / 100,
      cargoAfter: Math.round(afterCargo * 100) / 100,
      cargoAfterRate: Math.round(cargoAfterRate * 100) / 100,
      packagingAfter: Math.round(afterPackaging * 100) / 100,
      packagingAfterRate: Math.round(packagingAfterRate * 100) / 100,
      realProfit: Math.round(realProfit * 100) / 100,
      realProfitRate: Math.round(realProfitRate * 100) / 100,
    };
  }

  /**
   * Kar optimizasyonu - hangi fiyat daha iyi kar getirir?
   */
  async findOptimalPrice(
    productId: string,
    marketplaceKey?: MarketplaceKey,
    minPrice?: number,
    maxPrice?: number
  ): Promise<{ optimalPrice: number; optimalProfit: number; profitCurve: Array<{ price: number; profit: number }> }> {
    const calculation = await PricingEngine.calculate(productId, marketplaceKey);
    const basePrice = calculation.finalPrice;
    const min = minPrice || Math.round(basePrice * 0.8);
    const max = maxPrice || Math.round(basePrice * 1.3);
    const step = Math.max(1, Math.round((max - min) / 20));

    const profitCurve: Array<{ price: number; profit: number }> = [];
    let optimalPrice = basePrice;
    let optimalProfit = 0;

    for (let price = min; price <= max; price += step) {
      const profit = price - calculation.purchasePrice
        - (price * (calculation.commissionRate / 100))
        - calculation.cargoCost
        - calculation.packagingCost
        - calculation.fixedCost
        - calculation.categoryCost;

      profitCurve.push({ price, profit: Math.round(profit * 100) / 100 });

      if (profit > optimalProfit) {
        optimalProfit = profit;
        optimalPrice = price;
      }
    }

    return {
      optimalPrice: Math.round(optimalPrice * 100) / 100,
      optimalProfit: Math.round(optimalProfit * 100) / 100,
      profitCurve,
    };
  }
}
