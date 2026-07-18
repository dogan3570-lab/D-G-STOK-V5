// ==================== MarketplaceHttpClient V3.0 (Axios) ====================
// Ham HTTP istegini terminale basar, Axios ile guvenilir header gonderimi saglar

import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { HttpResponse } from './types.ts';

/**
 * Ham HTTP istegini backend terminaline basar
 */
function logRawRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  config: AxiosRequestConfig
) {
  console.log('\n========== HAM HTTP ISTEK ==========');
  console.log(`REQUEST URL:    ${method.toUpperCase()} ${url}`);
  console.log(`REQUEST METHOD: ${method.toUpperCase()}`);
  console.log('REQUEST HEADERS:');
  for (const [key, value] of Object.entries(headers)) {
    // API Key ve Secret'i maskele
    const masked = key.toLowerCase().includes('secret') || key.toLowerCase().includes('auth')
      ? value.substring(0, 8) + '...' + value.substring(value.length - 4)
      : value;
    console.log(`  ${key}: ${masked}`);
  }
  if (body) {
    console.log('REQUEST BODY:');
    console.log(`  ${body.substring(0, 500)}`);
  }
  console.log('FETCH/AXIOS CONFIG:');
  console.log(`  baseURL: ${config.baseURL || '(none)'}`);
  console.log(`  timeout: ${config.timeout || 15000}ms`);
  console.log(`  responseType: ${config.responseType || 'text'}`);
  // Axios headers'ini goster
  console.log('  AXIOS HEADERS (axios sends these):');
  if (config.headers) {
    const h = config.headers as Record<string, string>;
    for (const [key, value] of Object.entries(h)) {
      const masked = key.toLowerCase().includes('secret') || key.toLowerCase().includes('auth')
        ? String(value).substring(0, 8) + '...' + String(value).substring(String(value).length - 4)
        : String(value);
      console.log(`    ${key}: ${masked}`);
    }
  }
  console.log('====================================\n');
}

/**
 * Ham HTTP response'u terminale basar
 */
function logRawResponse(response: AxiosResponse | { status: number; statusText: string; headers: Record<string, string>; data: string; timing: number }) {
  console.log('\n========== HAM HTTP RESPONSE =========');
  console.log(`RESPONSE STATUS: ${response.status} ${response.statusText}`);
  console.log('RESPONSE HEADERS:');
  const headers = 'headers' in response ? response.headers : {};
  const headerObj = typeof headers === 'object' && !Array.isArray(headers) ? headers : {};
  for (const [key, value] of Object.entries(headerObj)) {
    console.log(`  ${key}: ${value}`);
  }
  const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  console.log(`RESPONSE BODY (ilk 500):`);
  console.log(`  ${data.substring(0, 500)}`);
  const timing = (response as any).timing;
  if (timing) console.log(`LATENCY: ${timing}ms`);
  console.log('======================================\n');
}

export class MarketplaceHttpClient {
  /**
   * Axios ile HTTP istegi atar.
   * Axios, Node.js fetch'ten farkli olarak header'lari asla modifiye etmez,
   * tum header'lari oldugu gibi gonderir.
   */
  static async request(url: string, options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
  }): Promise<HttpResponse> {
    const { method = 'GET', headers = {}, body, timeout = 15000 } = options;

    const startTime = Date.now();

    // Axios config
    const config: AxiosRequestConfig = {
      method: method as any,
      url,
      headers,
      timeout,
      // Header'lari asla modifiye etme
      transformRequest: [(data: any) => data],
      // Response'u text olarak al
      responseType: 'text',
      // Axios'un otomatik header eklemesini engelle
      validateStatus: () => true, // Tum status kodlarini kabul et
    };

    if (body) {
      config.data = body;
    }

    // Ham istegi terminale bas (gonderilmeden once)
    logRawRequest(url, method, headers, body, config);

    try {
      const response = await axios(config);
      const timing = Date.now() - startTime;

      // Response header'larini duzgun formata cevir
      const responseHeaders: Record<string, string> = {};
      if (response.headers && typeof response.headers === 'object') {
        for (const [key, value] of Object.entries(response.headers)) {
          responseHeaders[key.toLowerCase()] = String(value);
        }
      }

      const responseData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const truncatedBody = responseData.length > 1000
        ? responseData.substring(0, 1000) + '...[TRUNCATED]'
        : responseData;

      // Response'u terminale bas
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
          ? error.response.data.substring(0, 1000)
          : JSON.stringify(error.response.data).substring(0, 1000);
      }

      logRawResponse({
        status,
        statusText: error.code || 'Error',
        headers: responseHeaders,
        data: body,
        timing,
      });

      if (body.includes('ENOTFOUND') || body.includes('getaddrinfo')) {
        return { status: 0, statusText: 'DNS Error', headers: responseHeaders, body: `DNS cozumleme basarisiz: ${body}`, timing, server: 'N/A', contentType: undefined };
      }
      if (body.includes('ECONNREFUSED') || body.includes('ECONNRESET')) {
        return { status: 0, statusText: 'Connection Error', headers: responseHeaders, body: `Baglanti hatasi: ${body}`, timing, server: 'N/A', contentType: undefined };
      }
      if (error.code === 'ECONNABORTED' || body.includes('timeout')) {
        return { status: 0, statusText: 'Timeout', headers: responseHeaders, body: `Zaman asimi (${timeout}ms)`, timing, server: 'N/A', contentType: undefined };
      }

      return { status, statusText: error.code || 'Error', headers: responseHeaders, body: body.substring(0, 500), timing, server: responseHeaders['server'] || undefined, contentType: responseHeaders['content-type'] };
    }
  }

  static isCloudflareBlock(response: HttpResponse): boolean {
    const server = (response.server || '').toLowerCase();
    const bodyLower = response.body.toLowerCase();
    return (
      server === 'cloudflare' ||
      response.headers['cf-ray'] !== undefined ||
      bodyLower.includes('attention required') ||
      bodyLower.includes('you have been blocked')
    );
  }

  static isN11AuthError(response: HttpResponse): boolean {
    const server = (response.server || '').toLowerCase();
    const xProxy = (response.headers['x-proxy'] || '').toLowerCase();
    return (server.includes('openresty') || xProxy.includes('n11')) &&
      response.body.toLowerCase().includes('authentication parameters missing');
  }

  static isJsonResponse(response: HttpResponse): boolean {
    return (response.contentType || '').toLowerCase().includes('application/json');
  }
}
