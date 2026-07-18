// ==================== MARKETPLACE SDK - HTTP CLIENT V1.0 ====================
// Ortak HTTP istemci katmanı.
// Tüm pazaryerleri bu client'ı kullanır.
// İçinde: axios, timeout, retry, exponential backoff, queue, correlation ID,
//          EventBus, logger, request interceptor, response interceptor
// ===========================================================================

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { CorrelationId, createCorrelationId } from '../../eventBus/events.ts';
import { EventBus } from '../../eventBus/EventBus.ts';
import { MarketplaceRateLimiter } from './MarketplaceRateLimiter.ts';
import { MarketplaceQueue } from './MarketplaceQueue.ts';
import { MarketplaceRetry, RetryConfig } from './MarketplaceRetry.ts';
import { MarketplaceLogger } from './MarketplaceLogger.ts';
import { MarketplaceError } from './MarketplaceError.ts';
import { createSuccessResponse, createErrorResponse, MarketplaceResponse } from './MarketplaceResponse.ts';
import { MarketplaceConfig, MarketplaceKey, HttpMethod, OperationType, RequestPriority } from './MarketplaceTypes.ts';

/**
 * Marketplace HTTP Client.
 * 
 * Singleton pattern: Her pazaryeri için tek instance.
 * Tüm ayarlar MarketplaceConfig'den alınır.
 * 
 * Kullanım:
 * ```typescript
 * const client = MarketplaceClient.getInstance(config);
 * const response = await client.request({
 *   method: 'GET',
 *   path: '/suppliers/2738/products',
 *   operation: 'createProduct',
 * });
 * ```
 */
export class MarketplaceClient {
  private static instances = new Map<string, MarketplaceClient>();
  
  private readonly config: MarketplaceConfig;
  private readonly axiosInstance: AxiosInstance;
  private readonly rateLimiter: MarketplaceRateLimiter;
  private readonly queue: MarketplaceQueue;
  private readonly retry: MarketplaceRetry;

  private constructor(config: MarketplaceConfig) {
    this.config = config;
    this.rateLimiter = new MarketplaceRateLimiter({
      maxPerSecond: config.rateLimitPerSecond,
    });
    this.queue = new MarketplaceQueue(config.maxConcurrent);
    this.retry = new MarketplaceRetry({
      maxRetries: config.maxRetries,
      baseDelay: config.retryDelay,
      maxDelay: 30000,
      useJitter: true,
      retryOnStatus: [429, 500, 502, 503, 504],
      retryOnError: true,
    });

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

  static getInstance(config: MarketplaceConfig): MarketplaceClient {
    const key = config.key;
    if (!MarketplaceClient.instances.has(key)) {
      MarketplaceClient.instances.set(key, new MarketplaceClient(config));
    }
    return MarketplaceClient.instances.get(key)!;
  }

  static clearInstances(): void {
    MarketplaceClient.instances.clear();
  }

  getConfig(): MarketplaceConfig {
    return { ...this.config };
  }

  getQueueStats(): { pending: number; active: number } {
    return this.queue.getStats();
  }

  // ==================== INTERCEPTOR'LAR ====================

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const cid = (config as any).correlationId || createCorrelationId('API');
        (config as any).correlationId = cid;
        (config as any).__startTime = Date.now();

        config.headers = config.headers || {} as any;
        config.headers['X-Correlation-Id'] = cid;

        // Rate limit koruması
        await this.rateLimiter.acquire(this.config.key);

        MarketplaceLogger.logRequest({
          marketplaceKey: this.config.key,
          correlationId: cid,
          operation: (config as any).operation || 'health',
          method: (config.method?.toUpperCase() as HttpMethod) || 'GET',
          endpoint: config.url || '',
          requestBody: config.data,
        });

        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        const cid = (response.config as any)?.correlationId || 'unknown';
        const duration = Date.now() - ((response.config as any)?.__startTime || Date.now());
        const operation = (response.config as any)?.operation || 'health';

        MarketplaceLogger.logResponse({
          marketplaceKey: this.config.key,
          correlationId: cid,
          operation: operation as OperationType,
          method: (response.config.method?.toUpperCase() as HttpMethod) || 'GET',
          endpoint: response.config.url || '',
          status: response.status,
          duration,
          retryCount: 0,
        });

        (EventBus.emit as any)({
          type: 'MarketplaceResponse',
          correlationId: cid,
          timestamp: new Date().toISOString(),
          source: `MarketplaceClient[${this.config.key}]`,
          data: {
            marketplaceKey: this.config.key,
            operation: operation,
            success: true,
            status: response.status,
            duration,
            retryCount: 0,
          },
        });

        return response;
      },
      async (error: AxiosError) => {
        const cid = (error.config as any)?.correlationId || 'unknown';
        const duration = Date.now() - ((error.config as any)?.__startTime || Date.now());
        const operation = (error.config as any)?.operation || 'health';
        const httpStatus = error.response?.status || 0;

        MarketplaceLogger.logResponse({
          marketplaceKey: this.config.key,
          correlationId: cid,
          operation: operation as OperationType,
          method: (error.config?.method?.toUpperCase() as HttpMethod) || 'GET',
          endpoint: error.config?.url || '',
          status: httpStatus,
          duration,
          retryCount: 0,
          error: error.message,
        });

        (EventBus.emit as any)({
          type: 'MarketplaceResponse',
          correlationId: cid,
          timestamp: new Date().toISOString(),
          source: `MarketplaceClient[${this.config.key}]`,
          data: {
            marketplaceKey: this.config.key,
            operation: operation,
            success: false,
            status: httpStatus,
            duration,
            error: error.message,
            retryCount: 0,
          },
        });

        return Promise.reject(error);
      }
    );
  }

  // ==================== ANA İSTEK METODU ====================

  /**
   * Marketplace API'sine istek gönder.
   * Queue + Rate Limit + Retry + Exponential Backoff otomatik.
   */
  async request<T = any>(options: {
    method: HttpMethod;
    path: string;
    data?: any;
    params?: Record<string, string | number>;
    operation: OperationType;
    correlationId?: CorrelationId;
    priority?: RequestPriority;
    authHeaders?: Record<string, string>;
  }): Promise<MarketplaceResponse<T>> {
    const cid = options.correlationId || createCorrelationId('API');
    const startTime = Date.now();

    return this.queue.enqueue(
      this.config.key,
      options.operation,
      async () => {
        let lastError: any = null;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
          try {
            const axiosConfig: AxiosRequestConfig = {
              method: options.method,
              url: options.path,
              data: options.data,
              params: options.params,
              headers: {
                ...options.authHeaders,
              },
            };
            (axiosConfig as any).correlationId = cid;
            (axiosConfig as any).operation = options.operation;

            const response = await this.axiosInstance.request(axiosConfig);

            return createSuccessResponse(response.data, {
              status: response.status,
              duration: Date.now() - startTime,
              correlationId: cid,
              retryCount: attempt,
              raw: response.data,
            });

          } catch (err: any) {
            lastError = err;
            const httpStatus = err.response?.status || 0;

            // 429: Rate limit - token bucket'ı sıfırla
            if (httpStatus === 429) {
              const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '5');
              this.rateLimiter.handleRateLimit(this.config.key, retryAfter);
              
              MarketplaceLogger.logMessage('WARN',
                `⏳ Rate limited on ${this.config.key}, retry after ${retryAfter}s [${cid}]`
              );
            }

            // Retry kararı
            const decision = this.retry.decide(attempt, httpStatus, err);
            if (!decision.shouldRetry) {
              break;
            }

            MarketplaceLogger.logMessage('WARN',
              `🔄 Retry ${attempt + 1}/${this.config.maxRetries} for ${this.config.key}.${options.operation} ` +
              `after ${decision.delay}ms [${cid}]`
            );

            await new Promise(resolve => setTimeout(resolve, decision.delay));
          }
        }

        // Tüm denemeler başarısız
        const errResponse = lastError?.response;
        const httpStatus = errResponse?.status || 0;
        const errorBody = errResponse?.data;

        const marketplaceError = MarketplaceError.fromHttpStatus(
          httpStatus,
          cid,
          errorBody ? (typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody)) : lastError?.message
        );

        return createErrorResponse({
          code: marketplaceError.category,
          message: marketplaceError.message,
          httpStatus,
          details: errorBody,
          duration: Date.now() - startTime,
          correlationId: cid,
          retryCount: this.config.maxRetries,
          recoverable: marketplaceError.recoverable,
          raw: errorBody,
        });
      },
      {
        priority: options.priority || 'NORMAL',
        correlationId: cid,
        maxRetries: 0, // Queue içinde retry yapma (biz zaten yapıyoruz)
      }
    );
  }

  /** GET isteği */
  async get<T = any>(path: string, options?: {
    params?: Record<string, string | number>;
    operation?: OperationType;
    correlationId?: CorrelationId;
    priority?: RequestPriority;
    authHeaders?: Record<string, string>;
  }): Promise<MarketplaceResponse<T>> {
    return this.request<T>({
      method: 'GET',
      path,
      params: options?.params,
      operation: options?.operation || 'health',
      correlationId: options?.correlationId,
      priority: options?.priority,
      authHeaders: options?.authHeaders,
    });
  }

  /** POST isteği */
  async post<T = any>(path: string, data?: any, options?: {
    operation?: OperationType;
    correlationId?: CorrelationId;
    priority?: RequestPriority;
    authHeaders?: Record<string, string>;
  }): Promise<MarketplaceResponse<T>> {
    return this.request<T>({
      method: 'POST',
      path,
      data,
      operation: options?.operation || 'createProduct',
      correlationId: options?.correlationId,
      priority: options?.priority,
      authHeaders: options?.authHeaders,
    });
  }

  /** PUT isteği */
  async put<T = any>(path: string, data?: any, options?: {
    operation?: OperationType;
    correlationId?: CorrelationId;
    priority?: RequestPriority;
    authHeaders?: Record<string, string>;
  }): Promise<MarketplaceResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      path,
      data,
      operation: options?.operation || 'updateProduct',
      correlationId: options?.correlationId,
      priority: options?.priority,
      authHeaders: options?.authHeaders,
    });
  }

  /** DELETE isteği */
  async delete<T = any>(path: string, options?: {
    operation?: OperationType;
    correlationId?: CorrelationId;
    priority?: RequestPriority;
    authHeaders?: Record<string, string>;
  }): Promise<MarketplaceResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      path,
      operation: options?.operation || 'deleteProduct',
      correlationId: options?.correlationId,
      priority: options?.priority,
      authHeaders: options?.authHeaders,
    });
  }

  /** PATCH isteği */
  async patch<T = any>(path: string, data?: any, options?: {
    operation?: OperationType;
    correlationId?: CorrelationId;
    priority?: RequestPriority;
    authHeaders?: Record<string, string>;
  }): Promise<MarketplaceResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      path,
      data,
      operation: options?.operation || 'updateProduct',
      correlationId: options?.correlationId,
      priority: options?.priority,
      authHeaders: options?.authHeaders,
    });
  }
}
