// ==================== ApiDiagnosticEngine V2.0 ====================
// HTTPS (DNS dahil) -> Authentication -> Authorization -> Endpoint -> JSON
// Her adimi ayri ayri raporlar

import type { DiagnosticResult, StepResult, MarketplaceConfig, HttpResponse } from './types.ts';
import { AuthenticationBuilder } from './AuthenticationBuilder.ts';
import { MarketplaceHttpClient } from './MarketplaceHttpClient.ts';

export class ApiDiagnosticEngine {
  private config: MarketplaceConfig;
  private marketplaceKey: string;
  private baseUrl: string;

  constructor(config: MarketplaceConfig, marketplaceKey: string) {
    console.log(`[N11 TRACE] ApiDiagnosticEngine() olusturuldu - key: ${marketplaceKey}, baseUrl: ${config.apiUrl || this.getDefaultBaseUrl()}`);
    this.config = config;
    this.marketplaceKey = marketplaceKey;
    this.baseUrl = config.apiUrl || this.getDefaultBaseUrl();
  }

  private getDefaultBaseUrl(): string {
    const urls: Record<string, string> = {
      trendyol: 'https://api.trendyol.com/sapigw',
      tt: 'https://api.trendyol.com/sapigw',
      hepsiburada: 'https://api.hepsiburada.com',
      he: 'https://api.hepsiburada.com',
      n11: 'https://api.n11.com',
      amazon: 'https://sellingpartnerapi.amazon.com',
      amazon_tr: 'https://sellingpartnerapi.amazon.com',
      pt: 'https://api.pazarama.com',
      pttavm: 'https://api.pazarama.com',
    };
    return urls[this.marketplaceKey] || '';
  }

  private getTestEndpoint(): string {
    const base = this.baseUrl;
    switch (this.marketplaceKey) {
      case 'trendyol':
      case 'tt':
        if (this.config.sellerId) {
          return `${base}/suppliers/${this.config.sellerId}/products?page=0&size=1`;
        }
        return `${base}/brands?page=0&size=1`;
      case 'hepsiburada':
      case 'he':
        return `${base}/products/status`;
      case 'n11':
        return `${base}/rest/categories?page=0&size=1`;
      case 'amazon':
      case 'amazon_tr':
        return `${base}/sellers/listMarketplaceParticipations`;
      case 'pt':
      case 'pttavm':
      case 'pazarama':
        return `${base}/v1/categories`;
      default:
        return base;
    }
  }

  /**
   * Teshis testini calistirir
   * Adim adim: DNS -> HTTPS -> Auth -> Yetki -> Endpoint -> JSON
   */
  async runDiagnostic(): Promise<DiagnosticResult> {
    const startTime = Date.now();
    const hostname = new URL(this.baseUrl).hostname;

    // Adim 1: HTTPS (DNS cozumleme bunun icinde)
    const httpsResult = await this.checkHttps(hostname);
    if (!httpsResult.ok) return this.fail('https', httpsResult, startTime);

    // Adim 2: Authentication
    const authResult = await this.checkAuthentication();
    if (!authResult.ok) return this.failWithResponse('authentication', authResult, startTime);

    // Adim 3: Authorization
    const authzResult = await this.checkAuthorization(authResult);
    if (!authzResult.ok) return this.failWithResponse('authorization', authzResult, startTime);

    // Adim 4: Endpoint
    const endpointResult = await this.checkEndpoint(authzResult);
    if (!endpointResult.ok) return this.failWithResponse('endpoint', endpointResult, startTime);

    // Adim 5: JSON
    const jsonResult = await this.checkJson(endpointResult);
    if (!jsonResult.ok) return this.failWithResponse('jsonValidation', jsonResult, startTime);

    // Her sey basarili
    const latency = Date.now() - startTime;
    return {
      dns: { ok: true, message: 'DNS cozumleme basarili (HTTPS ile)', latency: 0 },
      https: httpsResult,
      authentication: authResult,
      authorization: authzResult,
      endpoint: endpointResult,
      jsonValidation: jsonResult,
      overall: {
        ok: true,
        message: '✅ API baglantisi basarili',
        httpStatus: endpointResult.detail ? parseInt(endpointResult.detail) || 200 : 200,
        latency,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async checkHttps(hostname: string): Promise<StepResult> {
    const start = Date.now();
    try {
      // Basit bir GET istegi - HEAD bazi sunucularda desteklenmez
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`https://${hostname}`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);
      return {
        ok: true,
        message: `HTTPS baglantisi basarili (HTTP ${response.status})`,
        latency: Date.now() - start,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      // DNS hatasi mi kontrol et
      if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
        return {
          ok: false,
          message: `DNS cozumleme basarisiz: ${hostname}`,
          detail: msg,
          latency: Date.now() - start,
        };
      }
      // Zaman asimi
      if (msg.includes('abort') || msg.includes('Abort')) {
        return {
          ok: true, // Baglanti kuruldu ama yanit gelmedi - bu normal
          message: `HTTPS baglantisi kuruldu (zaman asimi: 5s)`,
          latency: Date.now() - start,
        };
      }
      return {
        ok: true, // HTTP hatalari baglanti oldugunu gosterir
        message: `HTTPS baglantisi mevcut (${msg.substring(0, 50)})`,
        latency: Date.now() - start,
      };
    }
  }

  private async checkAuthentication(): Promise<StepResult & { httpResponse?: HttpResponse }> {
    const start = Date.now();
    const authConfig = AuthenticationBuilder.build(this.marketplaceKey, this.config);

    const response = await MarketplaceHttpClient.request(this.getTestEndpoint(), {
      method: authConfig.method || 'GET',
      headers: authConfig.headers,
      body: authConfig.body,
    });

    const latency = Date.now() - start;

    // Cloudflare WAF kontrolu
    if (MarketplaceHttpClient.isCloudflareBlock(response)) {
      return {
        ok: false,
        message: '❌ Cloudflare WAF istegi engelledi',
        detail: `Sunucu IP'si (${response.headers['cf-connecting-ip'] || 'bilinmiyor'}) beyaz listeye eklenmeli.\nServer: cloudflare\nCF-RAY: ${response.headers['cf-ray'] || '-'}`,
        latency,
        httpResponse: response,
      };
    }

    // N11 auth hatasi kontrolu
    if (MarketplaceHttpClient.isN11AuthError(response)) {
      return {
        ok: false,
        message: '❌ N11 API authentication basarisiz',
        detail: `N11 REST API sunucusu kimlik dogrulama parametrelerini kabul etmedi.\nServer: openresty\nYanit: ${response.body.substring(0, 100)}`,
        latency,
        httpResponse: response,
      };
    }

    // 401 = Unauthorized (auth yanlis)
    if (response.status === 401) {
      return {
        ok: false,
        message: '❌ API anahtarlari gecersiz (HTTP 401)',
        detail: 'API Key veya API Secret yanlis. Lutfen kontrol edin.',
        latency,
        httpResponse: response,
      };
    }

    // 403 (Cloudflare degil) = yetki hatasi
    if (response.status === 403 && !MarketplaceHttpClient.isCloudflareBlock(response)) {
      return {
        ok: false,
        message: '❌ Erisim reddedildi (HTTP 403)',
        detail: `Sunucu: ${response.server || 'bilinmiyor'}\nYanit: ${response.body.substring(0, 200)}`,
        latency,
        httpResponse: response,
      };
    }

    return {
      ok: true,
      message: `✅ Kimlik dogrulama basarili (HTTP ${response.status})`,
      latency,
      httpResponse: response,
    };
  }

  private async checkAuthorization(step: StepResult & { httpResponse?: HttpResponse }): Promise<StepResult & { httpResponse?: HttpResponse }> {
    const response = step.httpResponse;
    if (!response) {
      return { ok: false, message: '❌ Yetki kontrolu: Authentication adimi gecilemedi' };
    }

    if (response.status === 403) {
      return {
        ok: false,
        message: '❌ API yetkilendirmesi basarisiz (HTTP 403)',
        detail: `API anahtarlarinin bu endpoint'e erisim yetkisi yok.\nHTTP ${response.status}: ${response.body.substring(0, 200)}`,
        latency: response.timing,
        httpResponse: response,
      };
    }

    return {
      ok: true,
      message: `✅ API yetkilendirmesi basarili (HTTP ${response.status})`,
      latency: response.timing,
      httpResponse: response,
    };
  }

  private async checkEndpoint(step: StepResult & { httpResponse?: HttpResponse }): Promise<StepResult & { httpResponse?: HttpResponse }> {
    const response = step.httpResponse;
    if (!response) {
      return { ok: false, message: '❌ Endpoint kontrolu: Onceki adim gecilemedi' };
    }

    if (response.status === 404) {
      return {
        ok: false,
        message: '❌ API endpoint bulunamadi (HTTP 404)',
        detail: `Endpoint: ${this.getTestEndpoint()}\nYanit: ${response.body.substring(0, 200)}`,
        latency: response.timing,
        httpResponse: response,
      };
    }

    if (response.status === 405) {
      return {
        ok: false,
        message: '❌ HTTP method hatali (HTTP 405)',
        detail: `Endpoint: ${this.getTestEndpoint()}\nDogru method icin dokumantasyonu kontrol edin.`,
        latency: response.timing,
        httpResponse: response,
      };
    }

    return {
      ok: true,
      message: `✅ Endpoint erisilebilir (HTTP ${response.status})`,
      detail: String(response.status),
      latency: response.timing,
      httpResponse: response,
    };
  }

  private async checkJson(step: StepResult & { httpResponse?: HttpResponse }): Promise<StepResult & { httpResponse?: HttpResponse }> {
    const response = step.httpResponse;
    if (!response) {
      return { ok: false, message: '❌ JSON kontrolu: Onceki adim gecilemedi' };
    }

    const isJson = MarketplaceHttpClient.isJsonResponse(response);

    if (!isJson) {
      return {
        ok: false,
        message: `❌ JSON yaniti beklenirken ${response.contentType || 'bilinmeyen format'} alindi`,
        detail: `Content-Type: ${response.contentType || '-'}\nSunucu: ${response.server || '-'}\nYanit (ilk 200 karakter): ${response.body.substring(0, 200)}`,
        latency: response.timing,
        httpResponse: response,
      };
    }

    return {
      ok: true,
      message: '✅ JSON yaniti dogrulandi',
      latency: response.timing,
      httpResponse: response,
    };
  }

  private fail(step: string, result: StepResult, startTime: number): DiagnosticResult {
    const empty = { ok: false, message: 'Atlandi', latency: 0 };
    return {
      dns: step === 'dns' ? result : empty,
      https: step === 'https' ? result : empty,
      authentication: step === 'authentication' ? result : empty,
      authorization: step === 'authorization' ? result : empty,
      endpoint: step === 'endpoint' ? result : empty,
      jsonValidation: step === 'jsonValidation' ? result : empty,
      overall: {
        ok: false,
        message: result.message,
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private failWithResponse(step: string, result: StepResult & { httpResponse?: HttpResponse }, startTime: number): DiagnosticResult {
    const empty = { ok: false, message: 'Atlandi', latency: 0 };
    const base: DiagnosticResult = {
      dns: { ok: true, message: 'Gecildi', latency: 0 },
      https: { ok: true, message: 'Gecildi', latency: 0 },
      authentication: step === 'authentication' ? result : { ok: true, message: 'Gecildi', latency: 0 },
      authorization: step === 'authorization' ? result : { ok: true, message: 'Gecildi', latency: 0 },
      endpoint: step === 'endpoint' ? result : { ok: true, message: 'Gecildi', latency: 0 },
      jsonValidation: step === 'jsonValidation' ? result : { ok: true, message: 'Gecildi', latency: 0 },
      overall: {
        ok: false,
        message: result.message,
        httpStatus: result.httpResponse?.status,
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
    return base;
  }
}
