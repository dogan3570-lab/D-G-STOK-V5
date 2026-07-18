// ==================== TRENDYOL HTTP CLIENT V1.0 ====================
// Ortak HTTP istemci katmanı
// İçinde: timeout, retry, exponential backoff, correlation ID,
//          request/response interceptor, rate limit koruması, queue
// ===================================================================

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { TrendyolAuth } from './TrendyolAuth.ts';
import { EventBus } from '../../eventBus/EventBus.ts';
import { createCorrelationId, CorrelationId } from '../../eventBus/events.ts';

// ==================== TİPLER ====================

export interface TrendyolClientConfig {
  marketplaceKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  maxConcurrent: number;
  rateLimitPerSecond: number;
}

export interface TrendyolRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  data?: any;
  params?: Record<string, string | number>;
  correlationId?: CorrelationId;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
}

export interface TrendyolResponse<T = any> {
  success: boolean;
  data?: T;
  httpStatus: number;
  durationMs: number;
  correlationId: CorrelationId;
  error?: string;
  retryCount: number;
}

// ==================== RATE LİMİT KORUYUCU ====================

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;

  constructor(maxPerSecond: number) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.lastRefill = Date.now();
    this.refillIntervalMs = 1000;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refillTokens = Math.floor(elapsed / this.refillIntervalMs) * this.maxTokens;
    if (refillTokens > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + refillTokens);
      this.lastRefill = now;
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    // Token yoksa bekle
    const waitTime = this.refillIntervalMs - (Date.now() - this.lastRefill);
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.refill();
    this.tokens = Math.max(0, this.tokens - 1);
  }
}

// ==================== KUYRUK ====================

interface QueueItem {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
  correlationId: CorrelationId;
}

class RequestQueue {
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async enqueue<T>(
    fn: () => Promise<T>,
    priority: number = 0,
    correlationId: CorrelationId
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ execute: fn, resolve, reject, priority, correlationId });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) return;

    const item = this.queue.shift()!;
    this.activeCount++;

    item.execute()
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        this.activeCount--;
        this.processNext();
      });
  }

  get length(): number { return this.queue.length; }
  get active(): number { return this.activeCount; }
}

// ==================== TRENDYOL CLIENT ====================

export class TrendyolClient {
  private static instances = new Map<string, TrendyolClient>();
  private axiosInstance: AxiosInstance;
  private config: TrendyolClientConfig;
  private rateLimiter: RateLimiter;
  private queue: RequestQueue;

  private constructor(config: TrendyolClientConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimitPerSecond);
    this.queue = new RequestQueue(config.maxConcurrent);

    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DG-STOK-V5.0/1.0',
      },
    });

    this.setupInterceptors();
  }

  static getInstance(config: TrendyolClientConfig): TrendyolClient {
    const key = config.marketplaceKey;
    if (!TrendyolClient.instances.has(key)) {
      TrendyolClient.instances.set(key, new TrendyolClient(config));
    }
    return TrendyolClient.instances.get(key)!;
  }

  static clearInstances(): void {
    TrendyolClient.instances.clear();
  }

  // ==================== INTERCEPTOR'LAR ====================

  private setupInterceptors(): void {
    // Request interceptor: Auth header + Correlation ID
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const mpKey = this.config.marketplaceKey;

        // Correlation ID ekle (yoksa oluştur)
        if (!config.headers) config.headers = {} as any;
        const cid = (config as any).correlationId || createCorrelationId('API');
        (config as any).correlationId = cid;
        config.headers['X-Correlation-Id'] = cid;

        // Auth header ekle
        try {
          const authHeaders = await TrendyolAuth.getAuthHeader(mpKey);
          Object.assign(config.headers, authHeaders);
        } catch (err: any) {
          console.error(`[TrendyolClient] Auth hatası [${cid}]: ${err.message}`);
        }

        // Rate limit koruması
        await this.rateLimiter.acquire();

        console.log(`[TrendyolClient] ➡️ ${config.method?.toUpperCase()} ${config.url} [${cid}]`);

        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    // Response interceptor: Log + EventBus
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        const cid = (response.config as any)?.correlationId || 'unknown';
        const durationMs = this.calculateDuration(response);

        console.log(`[TrendyolClient] ⬅️ ${response.status} ${response.config.url} (${durationMs}ms) [${cid}]`);

        // EventBus'a bildir (any cast - operation tipi runtime'da belirlenir)
        EventBus.emit({
          type: 'MarketplaceResponse',
          correlationId: cid,
          timestamp: new Date().toISOString(),
          source: 'TrendyolClient',
          data: {
            marketplaceKey: this.config.marketplaceKey,
            adapterName: 'TrendyolClient',
            operation: 'health' as const,
            sku: 'N/A',
            success: true,
            durationMs,
            httpStatus: response.status,
            retryCount: 0,
            triggerType: 'API',
          },
        });

        return response;
      },
      async (error: AxiosError) => {
        const cid = (error.config as any)?.correlationId || 'unknown';
        const durationMs = this.calculateDurationFromError(error);

        console.error(`[TrendyolClient] ❌ ${error.response?.status || 'NETWORK'} ${error.config?.url} (${durationMs}ms) [${cid}]`);

        EventBus.emit({
          type: 'MarketplaceResponse',
          correlationId: cid,
          timestamp: new Date().toISOString(),
          source: 'TrendyolClient',
          data: {
            marketplaceKey: this.config.marketplaceKey,
            adapterName: 'TrendyolClient',
            operation: 'health' as const,
            sku: 'N/A',
            success: false,
            durationMs,
            httpStatus: error.response?.status,
            error: error.message,
            retryCount: 0,
            triggerType: 'API',
          },
        });

        return Promise.reject(error);
      }
    );
  }

  // ==================== ANA İSTEK METODU ====================

  async request<T = any>(options: TrendyolRequestOptions): Promise<TrendyolResponse<T>> {
    const cid = options.correlationId || createCorrelationId('API');
    const startTime = Date.now();
    let lastError: any = null;
    let retryCount = 0;

    // Queue'ya ekle (HIGH=10, NORMAL=0, LOW=-10)
    const priorityMap = { HIGH: 10, NORMAL: 0, LOW: -10 };
    const priority = priorityMap[options.priority || 'NORMAL'];

    return this.queue.enqueue(async () => {
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        retryCount = attempt;
        try {
          const axiosConfig: AxiosRequestConfig = {
            method: options.method,
            url: options.path,
            data: options.data,
            params: options.params,
          };
          (axiosConfig as any).correlationId = cid;

          const response = await this.axiosInstance.request(axiosConfig);

          return {
            success: true,
            data: response.data as T,
            httpStatus: response.status,
            durationMs: Date.now() - startTime,
            correlationId: cid,
            retryCount,
          };

        } catch (err: any) {
          lastError = err;

          // 429 (Rate Limit) - her zaman retry
          if (err.response?.status === 429) {
            const retryAfter = parseInt(err.response.headers?.['retry-after'] || '5') * 1000;
            console.log(`[TrendyolClient] ⏳ Rate limited, waiting ${retryAfter}ms [${cid}]`);
            await new Promise(r => setTimeout(r, retryAfter));
            continue;
          }

          // 401 (Unauthorized) - token yenile + retry
          if (err.response?.status === 401) {
            console.log(`[TrendyolClient] 🔑 Token expired, refreshing [${cid}]`);
            TrendyolAuth.clearCache();
            continue;
          }

          // 4xx (diğer) - retry yapma
          if (err.response?.status && err.response.status >= 400 && err.response.status < 500 && err.response.status !== 429) {
            break;
          }

          // 5xx veya network hatası - exponential backoff ile retry
          if (attempt < this.config.maxRetries) {
            const delay = this.config.retryDelay * Math.pow(2, attempt);
            console.log(`[TrendyolClient] 🔄 Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms [${cid}]`);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }

      // Tüm denemeler başarısız
      return {
        success: false,
        httpStatus: lastError?.response?.status || 0,
        durationMs: Date.now() - startTime,
        correlationId: cid,
        error: lastError?.response?.data
          ? (typeof lastError.response.data === 'string' ? lastError.response.data : JSON.stringify(lastError.response.data))
          : lastError?.message || 'Bilinmeyen hata',
        retryCount,
      };
    }, priority, cid);
  }

  // ==================== YARDIMCILAR ====================

  private calculateDuration(response: AxiosResponse): number {
    if (response.config && (response.config as any).__startTime) {
      return Date.now() - (response.config as any).__startTime;
    }
    return 0;
  }

  private calculateDurationFromError(error: AxiosError): number {
    if (error.config && (error.config as any).__startTime) {
      return Date.now() - (error.config as any).__startTime;
    }
    return 0;
  }

  // ==================== KONFİGÜRASYON ====================

  getConfig(): TrendyolClientConfig {
    return { ...this.config };
  }

  getQueueStats(): { pending: number; active: number } {
    return { pending: this.queue.length, active: this.queue.active };
  }

  /**
   * TrendyolClient instance'ı oluşturur veya mevcut olanı döndürür.
   * Marketplace tablosundaki ayarları kullanır.
   */
  static async createFromMarketplace(marketplaceKey: string): Promise<TrendyolClient> {
    const { prisma } = await import('../../../db/prisma.ts');
    const p = prisma as any;

    const mp = await p.marketplace.findUnique({
      where: { key: marketplaceKey },
      select: { apiUrl: true, settings: true },
    });

    const settings = mp?.settings ? (() => { try { return JSON.parse(mp.settings); } catch { return {}; } })() : {};

    return TrendyolClient.getInstance({
      marketplaceKey,
      baseUrl: mp?.apiUrl || settings.baseUrl || 'https://stageapi.trendyol.com',
      timeout: settings.timeout || 30000,
      maxRetries: settings.maxRetries || 3,
      retryDelay: settings.retryDelay || 1000,
      maxConcurrent: settings.maxConcurrent || 5,
      rateLimitPerSecond: settings.rateLimitPerSecond || 10,
    });
  }
}
