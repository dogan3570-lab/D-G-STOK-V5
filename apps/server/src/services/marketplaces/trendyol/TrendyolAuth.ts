// ==================== TRENDYOL AUTH V1.0 ====================
// OAuth / API Key authentication yönetimi
// Token caching + refresh mekanizması
// ============================================================

import { prisma } from '../../../db/prisma.ts';
import { EventBus } from '../../eventBus/EventBus.ts';
import { createCorrelationId } from '../../eventBus/events.ts';

const p = prisma as any;

export interface TrendyolCredentials {
  apiKey: string;
  apiSecret: string;
  supplierId: number;
}

export interface AuthToken {
  token: string;
  type: 'Basic' | 'Bearer';
  expiresAt: Date | null;
  createdAt: Date;
}

/**
 * Trendyol Authentication Yöneticisi
 * 
 * Trendyol Basic Auth kullanır (API Key + API Secret)
 * Token cache mekanizması ile gereksiz API çağrılarını önler
 */
export class TrendyolAuth {
  private static tokenCache = new Map<string, AuthToken>();
  private static readonly TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 dk

  /**
   * Marketplace kaydından Trendyol credentials alır
   */
  static async getCredentials(marketplaceKey: string): Promise<TrendyolCredentials> {
    const mp = await p.marketplace.findUnique({
      where: { key: marketplaceKey },
      select: {
        apiKey: true,
        apiSecret: true,
        settings: true,
      },
    });

    if (!mp) {
      throw new Error(`Trendyol marketplace bulunamadı: ${marketplaceKey}`);
    }

    if (!mp.apiKey || !mp.apiSecret) {
      throw new Error('Trendyol API Key veya Secret eksik');
    }

    let supplierId = 2738; // default stage
    try {
      if (mp.settings) {
        const s = JSON.parse(mp.settings);
        supplierId = parseInt(s.sellerId || s.supplierId || '2738');
      }
    } catch { /* ignore */ }

    return {
      apiKey: mp.apiKey,
      apiSecret: mp.apiSecret,
      supplierId,
    };
  }

  /**
   * Basic Auth token oluşturur (Base64)
   * Trendyol API Basic Auth kullanır
   */
  static async getToken(marketplaceKey: string): Promise<AuthToken> {
    const cacheKey = `trendyol:${marketplaceKey}`;
    
    // Cache kontrolü
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt) {
      const timeUntilExpiry = cached.expiresAt.getTime() - Date.now();
      if (timeUntilExpiry > this.TOKEN_REFRESH_MARGIN_MS) {
        return cached;
      }
    }

    // Yeni token oluştur
    const creds = await this.getCredentials(marketplaceKey);
    const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
    
    const authToken: AuthToken = {
      token,
      type: 'Basic',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 saat geçerli
      createdAt: new Date(),
    };

    // Cache'e ekle
    this.tokenCache.set(cacheKey, authToken);

    const correlationId = createCorrelationId('API');
    console.log(`[TrendyolAuth] Token created for ${marketplaceKey} [${correlationId}]`);

    return authToken;
  }

  /**
   * Authorization header'ı döndürür
   */
  static async getAuthHeader(marketplaceKey: string): Promise<Record<string, string>> {
    const auth = await this.getToken(marketplaceKey);
    return {
      'Authorization': `${auth.type} ${auth.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'DG-STOK-V5.0/1.0',
    };
  }

  /**
   * Token cache'ini temizler (test için)
   */
  static clearCache(): void {
    this.tokenCache.clear();
  }
}
