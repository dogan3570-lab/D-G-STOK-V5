// ==================== COMPETITOR ANALYZER V1 ====================
// Rakip fiyat analizi ve rekabet seviyesi tespiti
// ================================================================

import type { MarketplaceKey, CompetitorData } from './types.ts';

export class CompetitorAnalyzer {
  /**
   * Rekabet seviyesini analiz et (0-100)
   */
  async analyzeCompetition(productId: string, marketplaceKey?: MarketplaceKey): Promise<{
    level: number;
    competitors: CompetitorData[];
    marketAverage: number;
    marketRange: { min: number; max: number };
  }> {
    const competitors = await this.getCompetitorData(productId, marketplaceKey);

    if (competitors.length === 0) {
      return {
        level: 10, // Düşük rekabet
        competitors: [],
        marketAverage: 0,
        marketRange: { min: 0, max: 0 },
      };
    }

    const prices = competitors.map(c => c.competitorPrice);
    const marketAverage = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Rekabet seviyesi: çok sayıda rakip ve dar fiyat aralığı = yüksek rekabet
    const countFactor = Math.min(competitors.length / 10, 1); // 10+ rakip = max
    const spreadFactor = max > min ? 1 - (max - min) / max : 0; // Dar aralık = yüksek rekabet
    const level = Math.round((countFactor * 50 + spreadFactor * 50));

    return { level, competitors, marketAverage, marketRange: { min, max } };
  }

  /**
   * Rakip verilerini topla (gerçek implementasyonda API'den çekilir)
   */
  private async getCompetitorData(_productId: string, _marketplaceKey?: MarketplaceKey): Promise<CompetitorData[]> {
    // Gerçek implementasyonda pazaryeri API'lerinden rakip fiyatları çekilir
    // Şu an için simülasyon
    try {
      console.log(`[CompetitorAnalyzer] Fetching competitors for product ${_productId} on ${_marketplaceKey}`);
      // Simülasyon: boş dizi döndür
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Fiyat pozisyonunu belirle
   */
  determinePricePosition(currentPrice: number, marketAverage: number, marketMin: number, marketMax: number): {
    position: 'LOW' | 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE' | 'HIGH';
    score: number;
  } {
    if (currentPrice <= marketMin) return { position: 'LOW', score: 10 };
    if (currentPrice < marketAverage) return { position: 'BELOW_AVERAGE', score: 30 };
    if (currentPrice === marketAverage) return { position: 'AVERAGE', score: 50 };
    if (currentPrice < marketMax) return { position: 'ABOVE_AVERAGE', score: 70 };
    return { position: 'HIGH', score: 90 };
  }
}
