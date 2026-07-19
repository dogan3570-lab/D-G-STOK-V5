// ==================== N11 Provider V2.0 ====================
// TEK kaynak: N11 URL, auth, HTTP, entegrasyon, test
// API Test, gercek entegrasyon ile ayni endpoint'i kullanir

import axios, { AxiosRequestConfig } from 'axios';
import https from 'https';
import { prisma } from '../../db/prisma.ts';

export interface N11Product {
  id?: string;
  name?: string;
  price?: number;
  stock?: number;
  barcode?: string;
  sku?: string;
}

export class N11Provider {
  private static BASE_URL = 'https://api.n11.com';
  private apiKey: string;
  private apiSecret: string;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  static async fromMarketplaceId(marketplaceId: string): Promise<N11Provider | null> {
    const mp = await prisma.marketplace.findUnique({ where: { id: marketplaceId } });
    if (!mp || !mp.apiKey || !mp.apiSecret) return null;
    return new N11Provider(mp.apiKey, mp.apiSecret);
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'x-appKey': this.apiKey,
      'x-appSecret': this.apiSecret,
      'Accept': 'application/json',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };
  }

  /**
   * GERCEK ENTEGRASYON: Urunleri listele
   * API Test BU method'u cagirir, ayri test endpoint'i yoktur.
   */
  async getProducts(page: number = 0, size: number = 1): Promise<{
    ok: boolean;
    data?: N11Product[];
    total?: number;
    status: number;
    statusText: string;
    body: string;
    timing: number;
    headers: Record<string, string>;
    server?: string;
  }> {
    const url = `${N11Provider.BASE_URL}/rest/products?page=${page}&size=${size}`;
    const start = Date.now();

    console.log(`[N11] GET ${url}`);
    console.log(`[N11] Headers: x-appKey, x-appSecret, Accept`);

    const agent = new https.Agent({
      rejectUnauthorized: true,
      keepAlive: true,
      secureOptions: 0, // Varsayilan TLS ayarlari
    });

    const config: AxiosRequestConfig = {
      method: 'GET',
      url,
      headers: this.getAuthHeaders(),
      timeout: 15000,
      responseType: 'text',
      validateStatus: () => true,
      httpsAgent: agent,
    };

    try {
      const response = await axios(config);
      const timing = Date.now() - start;
      
      const respHeaders: Record<string, string> = {};
      if (response.headers && typeof response.headers === 'object') {
        for (const [key, value] of Object.entries(response.headers)) {
          respHeaders[key.toLowerCase()] = String(value);
        }
      }

      const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      console.log(`[N11] HTTP ${response.status} ${response.statusText} (${timing}ms)`);
      console.log(`[N11] Server: ${respHeaders['server'] || respHeaders['x-proxy'] || '-'}`);
      console.log(`[N11] Body: ${body.substring(0, 300)}`);

      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        body,
        timing,
        headers: respHeaders,
        server: respHeaders['server'] || respHeaders['x-proxy'],
      };
    } catch (error: any) {
      const timing = Date.now() - start;
      console.log(`[N11] Error: ${error.message}`);
      return {
        ok: false,
        status: 0,
        statusText: error.code || 'Error',
        body: error.message,
        timing,
        headers: {},
      };
    }
  }

  /**
   * API Test: getProducts() kullanir, ayri endpoint yok
   */
  async testConnection(): Promise<{
    ok: boolean;
    message: string;
    httpStatus?: number;
    contentType?: string;
    server?: string;
    timing?: number;
    body?: string;
  }> {
    const result = await this.getProducts(0, 1);

    if (result.ok) {
      return {
        ok: true,
        message: `Baglanti basarili - ${result.data?.length || 0} urun (HTTP ${result.status}, ${result.timing}ms)`,
        httpStatus: result.status,
        contentType: result.headers['content-type'],
        server: result.server,
        timing: result.timing,
        body: result.body.substring(0, 500),
      };
    }

    return {
      ok: false,
      message: result.body.substring(0, 200),
      httpStatus: result.status,
      contentType: result.headers['content-type'],
      server: result.server,
      timing: result.timing,
      body: result.body.substring(0, 500),
    };
  }
}
