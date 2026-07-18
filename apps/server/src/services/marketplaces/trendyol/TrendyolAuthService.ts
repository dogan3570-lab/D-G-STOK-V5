// ==================== TRENDYOL AUTH SERVİSİ V1.0 ====================
// Tek noktadan auth yönetimi. DRY prensibi.
// Tüm Trendyol servisleri buradan auth alır.
// ====================================================================

import { prisma } from '../../../db/prisma.ts';

const p = prisma as any;

export interface TrendyolAuthConfig {
  marketplaceKey: string;
  apiKey: string;
  apiSecret: string;
  supplierId: number;
  baseUrl: string;
  authHeader: string;
  isStage: boolean;
}

/**
 * Trendyol Auth Servisi.
 * Tüm Trendyol servisleri auth bilgilerini buradan alır.
 * 
 * Kullanım:
 * ```typescript
 * const auth = await TrendyolAuthService.getConfig('trendyol');
 * // auth.apiKey, auth.apiSecret, auth.supplierId, auth.authHeader
 * ```
 */
export class TrendyolAuthService {
  private static cache = new Map<string, { config: TrendyolAuthConfig; expiresAt: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 dk

  /**
   * Trendyol auth yapılandırmasını getir.
   * Sonuçlar 5 dk cache'lenir.
   */
  static async getConfig(marketplaceKey: string = 'trendyol'): Promise<TrendyolAuthConfig> {
    const cached = this.cache.get(marketplaceKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }

    const mp = await p.marketplace.findUnique({
      where: { key: marketplaceKey },
      select: { apiKey: true, apiSecret: true, apiUrl: true, settings: true },
    });

    if (!mp) {
      throw new Error(`Marketplace ${marketplaceKey} bulunamadı`);
    }
    if (!mp.apiKey || !mp.apiSecret) {
      throw new Error(`${marketplaceKey} API Key veya Secret eksik`);
    }

    let supplierId = 2738;
    if (mp.settings) {
      try {
        const s = JSON.parse(mp.settings);
        supplierId = parseInt(s.sellerId || s.supplierId || '2738');
      } catch { /* ignore */ }
    }

    const baseUrl = mp.apiUrl || 'https://stageapi.trendyol.com';
    const isStage = baseUrl.includes('stageapi') || baseUrl.includes('stage');
    const token = Buffer.from(`${mp.apiKey}:${mp.apiSecret}`).toString('base64');

    const config: TrendyolAuthConfig = {
      marketplaceKey,
      apiKey: mp.apiKey,
      apiSecret: mp.apiSecret,
      supplierId,
      baseUrl,
      authHeader: `Basic ${token}`,
      isStage,
    };

    this.cache.set(marketplaceKey, { config, expiresAt: Date.now() + this.CACHE_TTL });

    return config;
  }

  /**
   * Auth header'larını döndürür.
   */
  static async getAuthHeaders(marketplaceKey: string = 'trendyol'): Promise<Record<string, string>> {
    const config = await this.getConfig(marketplaceKey);
    return {
      'Authorization': config.authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'DG-STOK-V5.0/1.0',
    };
  }

  /**
   * Stage/Production prefix'ini döndürür.
   */
  static async getApiPrefix(marketplaceKey: string = 'trendyol'): Promise<string> {
    const config = await this.getConfig(marketplaceKey);
    const prodPrefix = '/sapigw';
    return config.isStage ? '/stagesapigw' : prodPrefix;
  }

  /**
   * Tam endpoint path'ini oluşturur.
   */
  static async buildPath(endpoint: string, marketplaceKey: string = 'trendyol'): Promise<string> {
    const [config, prefix] = await Promise.all([
      this.getConfig(marketplaceKey),
      this.getApiPrefix(marketplaceKey),
    ]);
    return `${prefix}/suppliers/${config.supplierId}${endpoint}`;
  }

  /**
   * Cache'i temizle (zorunlu refresh için).
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
