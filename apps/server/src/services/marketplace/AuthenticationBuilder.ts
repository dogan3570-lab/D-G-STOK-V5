// ==================== AuthenticationBuilder V2.0 ====================
// Her pazaryeri icin dogru authentication yapisini kurar
import type { AuthConfig, MarketplaceConfig } from './types.ts';

export class AuthenticationBuilder {
  /**
   * Trendyol: Basic Auth (apiKey:apiSecret)
   * Endpoint: GET /suppliers/{sellerId}/products?page=0&size=1
   */
  static trendyol(config: MarketplaceConfig): AuthConfig {
    const token = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64');
    return {
      type: 'BASIC',
      method: 'GET',
      headers: {
        'Authorization': `Basic ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'DG-Stok-V5/1.0',
      },
    };
  }

  /**
   * N11: x-appKey + x-appSecret header ile REST API
   * Endpoint: GET /rest/categories?page=0&size=1
   */
  static n11(config: MarketplaceConfig): AuthConfig {
    return {
      type: 'HEADER',
      method: 'GET',
      headers: {
        'x-appKey': config.apiKey,
        'x-appSecret': config.apiSecret,
        'Accept': 'application/json',
        'User-Agent': 'DG-Stok-V5/1.0',
      },
    };
  }

  /**
   * Hepsiburada: Basic Auth (apiKey:apiSecret)
   * Endpoint: GET /products/status
   */
  static hepsiburada(config: MarketplaceConfig): AuthConfig {
    const token = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64');
    return {
      type: 'BASIC',
      method: 'GET',
      headers: {
        'Authorization': `Basic ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'DG-Stok-V5/1.0',
      },
    };
  }

  /**
   * Amazon SP-API: Bearer Token
   */
  static amazon(config: MarketplaceConfig): AuthConfig {
    return {
      type: 'BEARER',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'DG-Stok-V5/1.0',
        'x-amz-access-token': config.apiKey,
      },
    };
  }

  /**
   * Pazarama/PttAVM: Basic Auth
   */
  static pazarama(config: MarketplaceConfig): AuthConfig {
    const token = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64');
    return {
      type: 'BASIC',
      method: 'GET',
      headers: {
        'Authorization': `Basic ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'DG-Stok-V5/1.0',
      },
    };
  }

  /**
   * Factory method: Pazaryeri key'ine gore dogru builder'i secer
   */
  static build(key: string, config: MarketplaceConfig): AuthConfig {
    console.log(`[N11 TRACE] AuthenticationBuilder.build() cagrildi - key: ${key}`);
    switch (key) {
      case 'trendyol':
      case 'tt':
        const tResult = AuthenticationBuilder.trendyol(config);
        console.log(`[N11 TRACE] AuthenticationBuilder - Trendyol auth olusturuldu, type: ${tResult.type}`);
        return tResult;
      case 'n11':
        const nResult = AuthenticationBuilder.n11(config);
        console.log(`[N11 TRACE] AuthenticationBuilder - N11 auth olusturuldu, type: ${nResult.type}, headers: ${JSON.stringify(nResult.headers, null, 2)}`);
        return nResult;
      case 'hepsiburada':
      case 'he':
        return AuthenticationBuilder.hepsiburada(config);
      case 'amazon':
      case 'amazon_tr':
        return AuthenticationBuilder.amazon(config);
      case 'pt':
      case 'pttavm':
      case 'pazarama':
        return AuthenticationBuilder.pazarama(config);
      default:
        return {
          type: 'NONE',
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'DG-Stok-V5/1.0',
          },
        };
    }
  }
}
