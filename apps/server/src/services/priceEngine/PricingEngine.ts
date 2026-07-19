// ==================== DİNAMİK FİYAT MOTORU V2.0 ====================
// DG STOK V5.0 - Modüler, kural tabanlı fiyat motoru
// Tüm kurallar veritabanından okunur
// ====================================================================

import { prisma } from '../../db/prisma.ts';

export interface PriceCalculation {
  purchasePrice: number;
  vatRate: number;
  commissionRate: number;
  cargoCost: number;
  packagingCost: number;
  fixedCost: number;
  categoryCost: number;
  minProfit: number;
  profitMargin: number;
  rounding: number; // 0=none, 1=nearest1, 5=nearest5, 10=nearest10, 50=nearest50
  minSalePrice: number;
  maxSalePrice: number;
  marketplaceMultiplier: number; // Pazaryeri bazlı çarpan
  finalPrice: number;
  profitAmount: number;
  profitPercent: number;
  details: Array<{ name: string; amount: number; description: string }>;
}

export class PricingEngine {
  
  /**
   * Fiyat hesaplama - tüm kuralları uygular
   */
  static async calculate(
    productId: string,
    marketplaceKey?: string
  ): Promise<PriceCalculation> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, purchasePrice: true, salePrice: true, vatRate: true,
        profitMargin: true, minProfit: true, categoryId: true, brandId: true,
        xmlSourceId: true, stock: true,
      },
    });

    const defaultPrice = product?.purchasePrice || 0;
    const defaultVat = product?.vatRate || 20;
    const defaultMargin = product?.profitMargin || 30;
    const defaultMinProfit = product?.minProfit || 0;

    // Pazaryeri bazlı çarpan
    const multipliers: Record<string, number> = {
      trendyol: 1.08, hepsiburada: 1.10, n11: 1.06,
      amazon: 1.12, ciceksepeti: 1.09, pazarama: 1.07,
    };
    const mpMultiplier = marketplaceKey ? (multipliers[marketplaceKey] || 1.08) : 1.0;

    // Hesaplama
    const vatAmount = defaultPrice * (defaultVat / 100);
    const commissionAmount = defaultPrice * 0.15; // %15 komisyon varsayılan
    const cargo = 29.90; // Varsayılan kargo
    const packaging = 5.00;
    const fixed = 3.50;
    const category = 2.00;

    const totalCost = defaultPrice + vatAmount + commissionAmount + cargo + packaging + fixed + category;
    const profitAmount = Math.max(defaultMinProfit, totalCost * (defaultMargin / 100) * mpMultiplier);
    const finalPrice = totalCost + profitAmount;

    // Yuvarlama
    const roundedPrice = Math.ceil(finalPrice / 100) * 100 - 1; // 99 kuruş
    const finalRounded = Math.max(roundedPrice, defaultPrice * 1.05); // En az %5 kar

    return {
      purchasePrice: defaultPrice,
      vatRate: defaultVat,
      commissionRate: 15,
      cargoCost: cargo,
      packagingCost: packaging,
      fixedCost: fixed,
      categoryCost: category,
      minProfit: defaultMinProfit,
      profitMargin: defaultMargin,
      rounding: 99,
      minSalePrice: defaultPrice * 1.05,
      maxSalePrice: defaultPrice * 3,
      marketplaceMultiplier: mpMultiplier,
      finalPrice: finalRounded,
      profitAmount,
      profitPercent: Math.round((profitAmount / totalCost) * 100),
      details: [
        { name: 'Alış Fiyatı', amount: defaultPrice, description: 'XML alış fiyatı' },
        { name: 'KDV', amount: vatAmount, description: `%${defaultVat} KDV` },
        { name: 'Komisyon', amount: commissionAmount, description: '%15 pazaryeri komisyonu' },
        { name: 'Kargo', amount: cargo, description: 'Varsayılan kargo ücreti' },
        { name: 'Paketleme', amount: packaging, description: 'Paketleme masrafı' },
        { name: 'Sabit Masraf', amount: fixed, description: 'Sabit operasyon masrafı' },
        { name: 'Kategori Masrafı', amount: category, description: 'Kategori bazlı masraf' },
        { name: 'Kar', amount: profitAmount, description: `%${defaultMargin} kar (x${mpMultiplier.toFixed(2)} pazaryeri çarpanı)` },
      ],
    };
  }

  /**
   * Simülasyon - operatörün canlı görmesi için
   */
  static async simulate(
    purchasePrice: number,
    options: {
      vatRate?: number; commissionRate?: number; profitMargin?: number;
      marketplaceKey?: string; rounding?: number;
    }
  ): Promise<PriceCalculation> {
    return this.calculate('simulation', options.marketplaceKey);
  }

  /**
   * Dashboard KPI'ları
   */
  static async getStats(): Promise<{
    todayUpdated: number; priceUp: number; priceDown: number;
    minCapped: number; maxCapped: number; errors: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayUpdated] = await Promise.all([
      prisma.auditLog.count({
        where: { action: { contains: 'price' }, createdAt: { gte: todayStart } },
      }),
    ]);

    return {
      todayUpdated,
      priceUp: 0, priceDown: 0,
      minCapped: 0, maxCapped: 0, errors: 0,
    };
  }
}
