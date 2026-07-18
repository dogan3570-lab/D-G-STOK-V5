// ==================== TRENDYOL STAGE PROVIDER V1.0 ====================
// Bağımsız Stage Provider - Production kodundan hiçbir şey kullanmaz
// Sadece Trendyol Stage ortamı için çalışır
// Base URL: https://stageapi.trendyol.com
// Supplier ID: 2738
// =====================================================================

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// ==================== TYPES ====================

export interface TrendyolStageConfig {
  apiKey: string;
  apiSecret: string;
  supplierId: number;
  baseUrl: string;
}

export interface StageRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  queryParams?: Record<string, string>;
  body?: string;
  extraHeaders?: Record<string, string>;
}

export interface StageHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timing: number;
  contentType?: string;
  server?: string;
}

// ==================== RAW HTTP LOG ====================

function logRawRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  queryParams: Record<string, string> | undefined,
  body: string | undefined
) {
  const maskedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower.includes('authorization') || lower.includes('auth') || lower.includes('secret')) {
      maskedHeaders[key] = value.substring(0, 12) + '...' + value.substring(value.length - 4);
    } else {
      maskedHeaders[key] = value;
    }
  }

  const fullUrl = queryParams && Object.keys(queryParams).length > 0
    ? url + '?' + new URLSearchParams(queryParams).toString()
    : url;

  console.log('\n');
  console.log('='.repeat(60));
  console.log('  TRENDYOL STAGE - HAM HTTP İSTEK');
  console.log('='.repeat(60));
  console.log(`  URL:     ${method.toUpperCase()} ${fullUrl}`);
  console.log(`  Method:  ${method.toUpperCase()}`);
  if (queryParams && Object.keys(queryParams).length > 0) {
    console.log(`  Query:   ${JSON.stringify(queryParams)}`);
  }
  console.log('  Headers:');
  for (const [key, value] of Object.entries(maskedHeaders)) {
    console.log(`    ${key}: ${value}`);
  }
  if (body) {
    console.log('  Body:');
    console.log(`    ${body}`);
  }
  console.log('-'.repeat(60));
}

function logRawResponse(response: AxiosResponse | { status: number; statusText: string; headers: Record<string, string>; data: string; timing: number }) {
  console.log('\n  RESPONSE:');
  console.log(`  Status:  ${response.status} ${response.statusText}`);
  console.log('  Headers:');
  const headers = 'headers' in response ? response.headers : {};
  const headerObj = typeof headers === 'object' && !Array.isArray(headers) ? headers : {};
  for (const [key, value] of Object.entries(headerObj)) {
    console.log(`    ${key}: ${value}`);
  }
  const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  console.log('  Body:');
  console.log(`    ${data.substring(0, 2000)}`);
  const timing = (response as any).timing;
  if (timing) console.log(`  Timing: ${timing}ms`);
  console.log('='.repeat(60));
  console.log('');
}

// ==================== AUTHENTICATION ====================

/**
 * Trendyol API Authentication
 * 
 * Trendyol dokümantasyonuna göre:
 * - Authorization: Basic base64(apiKey:apiSecret)
 * - Accept: application/json
 * - Content-Type: application/json
 * - User-Agent: (kendi uygulama adı)
 */
function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const credentials = `${apiKey}:${apiSecret}`;
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
}

function buildHeaders(config: TrendyolStageConfig): Record<string, string> {
  return {
    'Authorization': buildAuthHeader(config.apiKey, config.apiSecret),
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'DGSTOK-V5.0-Stage/1.0',
  };
}

// ==================== HTTP CLIENT ====================

export async function sendStageRequest(
  config: TrendyolStageConfig,
  options: StageRequestOptions
): Promise<StageHttpResponse> {
  const { method, endpoint, queryParams, body, extraHeaders } = options;

  const headers = {
    ...buildHeaders(config),
    ...extraHeaders,
  };

  const fullUrl = `${config.baseUrl}${endpoint}`;

  // Axios config - header'ları asla modifiye etme
  const axiosConfig: AxiosRequestConfig = {
    method: method.toLowerCase() as any,
    url: fullUrl,
    params: queryParams,
    headers,
    timeout: 30000, // 30 saniye
    transformRequest: [(data: any) => data], // Header'ları modifiye etme
    responseType: 'text',
    validateStatus: () => true, // Tüm status kodlarını kabul et
  };

  if (body) {
    axiosConfig.data = body;
  }

  // REQUEST LOG
  logRawRequest(fullUrl, method, headers, queryParams, body);

  const startTime = Date.now();

  try {
    const response = await axios(axiosConfig);
    const timing = Date.now() - startTime;

    // Response header'larını normalize et
    const responseHeaders: Record<string, string> = {};
    if (response.headers && typeof response.headers === 'object') {
      for (const [key, value] of Object.entries(response.headers)) {
        responseHeaders[key.toLowerCase()] = String(value);
      }
    }

    const responseData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const truncatedBody = responseData.length > 2000
      ? responseData.substring(0, 2000) + '\n  ...[TRUNCATED]'
      : responseData;

    // RESPONSE LOG
    logRawResponse({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data: truncatedBody,
      timing,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: truncatedBody,
      timing,
      server: responseHeaders['server'] || responseHeaders['x-proxy'] || undefined,
      contentType: responseHeaders['content-type'],
    };
  } catch (error: any) {
    const timing = Date.now() - startTime;

    let body = error.message || 'Bilinmeyen hata';
    let status = 0;
    let responseHeaders: Record<string, string> = {};

    if (error.response) {
      status = error.response.status;
      if (error.response.headers) {
        for (const [key, value] of Object.entries(error.response.headers)) {
          responseHeaders[key.toLowerCase()] = String(value);
        }
      }
      body = typeof error.response.data === 'string'
        ? error.response.data.substring(0, 2000)
        : JSON.stringify(error.response.data).substring(0, 2000);
    }

    // HATA LOG
    logRawResponse({
      status,
      statusText: error.code || 'Error',
      headers: responseHeaders,
      data: body,
      timing,
    });

    if (body.includes('ENOTFOUND') || body.includes('getaddrinfo')) {
      return { status: 0, statusText: 'DNS_ERROR', headers: responseHeaders, body: `DNS çözümleme başarısız: ${body}`, timing, server: 'N/A', contentType: undefined };
    }
    if (body.includes('ECONNREFUSED') || body.includes('ECONNRESET')) {
      return { status: 0, statusText: 'CONNECTION_ERROR', headers: responseHeaders, body: `Bağlantı hatası: ${body}`, timing, server: 'N/A', contentType: undefined };
    }
    if (error.code === 'ECONNABORTED' || body.includes('timeout')) {
      return { status: 0, statusText: 'TIMEOUT', headers: responseHeaders, body: `Zaman aşımı (30sn)`, timing, server: 'N/A', contentType: undefined };
    }

    return { status, statusText: error.code || 'ERROR', headers: responseHeaders, body: body.substring(0, 500), timing, server: responseHeaders['server'] || undefined, contentType: responseHeaders['content-type'] };
  }
}

// ==================== TRENDYOL STAGE API ENDPOINTS ====================

export class TrendyolStageProvider {
  private config: TrendyolStageConfig;

  constructor(apiKey: string, apiSecret: string, supplierId: number = 2738) {
    this.config = {
      apiKey,
      apiSecret,
      supplierId,
      baseUrl: 'https://stageapi.trendyol.com',
    };
  }

  /**
   * Siparişleri getir
   * GET /stagesapigw/suppliers/{supplierId}/orders
   */
  async getOrders(startDate: string): Promise<StageHttpResponse> {
    return sendStageRequest(this.config, {
      method: 'GET',
      endpoint: `/stagesapigw/suppliers/${this.config.supplierId}/orders`,
      queryParams: { startDate },
    });
  }

  /**
   * Ürünleri getir
   * GET /stagesapigw/suppliers/{supplierId}/products
   */
  async getProducts(page: number = 0, size: number = 100): Promise<StageHttpResponse> {
    return sendStageRequest(this.config, {
      method: 'GET',
      endpoint: `/stagesapigw/suppliers/${this.config.supplierId}/products`,
      queryParams: {
        page: String(page),
        size: String(size),
      },
    });
  }

  /**
   * Kategorileri getir
   * GET /stagesapigw/suppliers/{supplierId}/categories
   */
  async getCategories(): Promise<StageHttpResponse> {
    return sendStageRequest(this.config, {
      method: 'GET',
      endpoint: `/stagesapigw/suppliers/${this.config.supplierId}/categories`,
    });
  }

  /**
   * Marka listesini getir
   * GET /stagesapigw/suppliers/{supplierId}/brands
   */
  async getBrands(): Promise<StageHttpResponse> {
    return sendStageRequest(this.config, {
      method: 'GET',
      endpoint: `/stagesapigw/suppliers/${this.config.supplierId}/brands`,
    });
  }

  /**
   * Ürün gönder (create/update)
   * POST /stagesapigw/suppliers/{supplierId}/products
   */
  async sendProducts(body: string): Promise<StageHttpResponse> {
    return sendStageRequest(this.config, {
      method: 'POST',
      endpoint: `/stagesapigw/suppliers/${this.config.supplierId}/products`,
      body,
    });
  }

  /**
   * Bağlantı testi - API'nin çalışıp çalışmadığını kontrol eder
   */
  async testConnection(): Promise<{
    success: boolean;
    response: StageHttpResponse;
    diagnostics: {
      dns: boolean;
      tls: boolean;
      auth: boolean;
      endpoint: boolean;
    };
  }> {
    console.log('\n' + '='.repeat(60));
    console.log('  TRENDYOL STAGE - BAĞLANTI TESTİ');
    console.log('='.repeat(60));
    console.log(`  Base URL:    ${this.config.baseUrl}`);
    console.log(`  Supplier ID: ${this.config.supplierId}`);
    console.log(`  API Key:     ${this.config.apiKey.substring(0, 8)}...${this.config.apiKey.substring(this.config.apiKey.length - 4)}`);
    console.log(`  Time:        ${new Date().toISOString()}`);
    console.log('-'.repeat(60));

    const response = await this.getOrders(new Date().toISOString().split('T')[0]);

    const diagnostics = {
      dns: response.status !== 0 && !response.body.includes('DNS'),
      tls: response.status !== 0 && !response.body.includes('ENOTFOUND'),
      auth: response.status !== 401 && response.status !== 403,
      endpoint: response.status === 200 || response.status === 204,
    };

    console.log('\n  TANI SONUÇLARI:');
    console.log(`  DNS:       ${diagnostics.dns ? '✅' : '❌'} ${response.body.includes('DNS') ? response.body : 'OK'}`);
    console.log(`  TLS:       ${diagnostics.tls ? '✅' : '❌'}`);
    console.log(`  Auth:      ${diagnostics.auth ? '✅' : '❌'} ${response.status === 401 ? '401 Unauthorized' : response.status === 403 ? '403 Forbidden' : 'OK'}`);
    console.log(`  Endpoint:  ${diagnostics.endpoint ? '✅' : '❌'} HTTP ${response.status}`);
    console.log(`  Timing:    ${response.timing}ms`);
    console.log('='.repeat(60) + '\n');

    return {
      success: diagnostics.dns && diagnostics.tls && diagnostics.auth && diagnostics.endpoint,
      response,
      diagnostics,
    };
  }
}
