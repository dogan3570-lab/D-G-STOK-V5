// ==================== TRENDYOL ADAPTER V1.0 ====================
// BaseMarketplaceAdapter → TrendyolAdapter
// Marketplace SDK üzerinden Trendyol API entegrasyonu
// ============================================================

import { prisma } from '../../../db/prisma.ts';
import { createCorrelationId, CorrelationId } from '../../eventBus/events.ts';
import { EventBus } from '../../eventBus/EventBus.ts';
import { BaseMarketplaceAdapter } from '../core/MarketplaceAdapter.ts';
import { MarketplaceClient } from '../core/MarketplaceClient.ts';
import { MarketplaceLogger } from '../core/MarketplaceLogger.ts';
import { createSuccessResponse, createErrorResponse, MarketplaceResponse } from '../core/MarketplaceResponse.ts';
import { MarketplaceError } from '../core/MarketplaceError.ts';
import {
  MarketplaceConfig,
  MarketplaceProduct,
  MarketplaceOrder,
  MarketplaceShipment,
  MarketplaceCategory,
  MarketplaceBrand,
  MarketplaceHealthMetrics,
  ConnectionStatus,
} from '../core/MarketplaceTypes.ts';
import { TrendyolProductMapper, TrendyolProductItem } from './TrendyolProductMapper.ts';
import { TrendyolBatchScheduler } from './TrendyolBatchService.ts';

const p = prisma as any;

/**
 * Trendyol Adapter
 * 
 * Trendyol API'sine bağlantı, kategori ve marka listeleme işlemleri.
 * Diğer işlemler (ürün, stok, fiyat, sipariş) Not Implemented.
 * 
 * API Dokümantasyonu:
 * - Base URL: https://stageapi.trendyol.com (stage) / https://api.trendyol.com (production)
 * - Auth: Basic Auth (apiKey:apiSecret)
 * - Endpoint: /stagesapigw/suppliers/{supplierId}/...
 * - Rate Limit: Saniyede 10 istek
 */
export class TrendyolAdapter extends BaseMarketplaceAdapter {
  public readonly key = 'trendyol';
  public readonly name = 'Trendyol';
  private supplierId: number = 2738;
  private apiKey: string = '';
  private apiSecret: string = '';

  private constructor(config: MarketplaceConfig) {
    super(config);
  }

  /**
   * TrendyolAdapter instance'ı oluştur.
   * Marketplace tablosundaki credentials'ları kullanır.
   */
  static async create(marketplaceKey: string = 'trendyol'): Promise<TrendyolAdapter> {
    const mp = await p.marketplace.findUnique({
      where: { key: marketplaceKey },
      select: {
        apiKey: true,
        apiSecret: true,
        apiUrl: true,
        settings: true,
      },
    });

    if (!mp) {
      throw new Error(`Trendyol marketplace bulunamadı: ${marketplaceKey}`);
    }

    let supplierId = 2738;
    let timeout = 30000;
    let maxRetries = 3;
    let retryDelay = 1000;
    let maxConcurrent = 5;
    let rateLimitPerSecond = 10;

    if (mp.settings) {
      try {
        const s = JSON.parse(mp.settings);
        supplierId = parseInt(s.sellerId || s.supplierId || '2738');
        timeout = s.timeout || 30000;
        maxRetries = s.maxRetries || 3;
        retryDelay = s.retryDelay || 1000;
        maxConcurrent = s.maxConcurrent || 5;
        rateLimitPerSecond = s.rateLimitPerSecond || 10;
      } catch { /* ignore */ }
    }

    const config: MarketplaceConfig = {
      key: 'trendyol',
      name: 'Trendyol',
      baseUrl: mp.apiUrl || 'https://stageapi.trendyol.com',
      credentials: {
        apiKey: mp.apiKey || undefined,
        apiSecret: mp.apiSecret || undefined,
      },
      timeout,
      maxRetries,
      retryDelay,
      maxConcurrent,
      rateLimitPerSecond,
    };

    const adapter = new TrendyolAdapter(config);
    adapter.supplierId = supplierId;
    adapter.apiKey = mp.apiKey || '';
    adapter.apiSecret = mp.apiSecret || '';

    return adapter;
  }

  // ==================== ÖZEL YARDIMCILAR ====================

  /** Basic Auth header'ı oluştur */
  private getAuthHeaders(): Record<string, string> {
    const token = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return {
      'Authorization': `Basic ${token}`,
    };
  }


  // ==================== BAĞLANTI & SAĞLIK ====================

  async connect(): Promise<MarketplaceResponse<void>> {
    const cid = createCorrelationId('API');
    MarketplaceLogger.logMessage('INFO', `Connecting to Trendyol API [${cid}]`, {
      marketplaceKey: 'trendyol',
      correlationId: cid,
    });

    try {
      // Bağlantı testi olarak brands API'ini çağır
      const result = await this.getClient().get(this.apiEndpoint('/brands'), {
        params: { page: '0', size: '1' },
        operation: 'health',
        correlationId: cid,
        authHeaders: this.getAuthHeaders(),
      });

      if (result.success) {
        this.setConnectionStatus('connected');
        MarketplaceLogger.logMessage('INFO', `✅ Trendyol API connected [${cid}]`, {
          marketplaceKey: 'trendyol',
          correlationId: cid,
        });
        return createSuccessResponse(undefined, {
          status: result.status,
          duration: result.duration,
          correlationId: cid,
        });
      } else {
        this.setConnectionStatus('error');
        return createErrorResponse({
          code: 'CONNECTION_ERROR',
          message: result.error?.message || 'Bağlantı başarısız',
          httpStatus: result.status,
          duration: result.duration,
          correlationId: cid,
        });
      }
    } catch (err: any) {
      this.setConnectionStatus('error');
      return createErrorResponse({
        code: 'NETWORK_ERROR',
        message: err.message,
        duration: 0,
        correlationId: cid,
        recoverable: true,
      });
    }
  }

  async health(): Promise<MarketplaceResponse<MarketplaceHealthMetrics>> {
    const cid = createCorrelationId('API');
    const startTime = Date.now();

    try {
      const result = await this.getClient().get(this.apiEndpoint('/brands'), {
        params: { page: '0', size: '1' },
        operation: 'health',
        correlationId: cid,
        authHeaders: this.getAuthHeaders(),
      });

      const healthy = result.success;
      const latency = Date.now() - startTime;

      const metrics: MarketplaceHealthMetrics = {
        healthy,
        latency,
        successRate: healthy ? 100 : 0,
        totalRequests: 1,
        errorCount: healthy ? 0 : 1,
        rateLimitCount: result.status === 429 ? 1 : 0,
        avgResponseTime: latency,
        lastCheckedAt: new Date().toISOString(),
      };

      return createSuccessResponse(metrics, {
        status: result.status,
        duration: latency,
        correlationId: cid,
      });
    } catch (err: any) {
      return createSuccessResponse({
        healthy: false,
        latency: Date.now() - startTime,
        successRate: 0,
        totalRequests: 1,
        errorCount: 1,
        rateLimitCount: 0,
        avgResponseTime: Date.now() - startTime,
        lastCheckedAt: new Date().toISOString(),
      }, {
        status: 0,
        duration: Date.now() - startTime,
        correlationId: cid,
      });
    }
  }

  async testConnection(): Promise<MarketplaceResponse<boolean>> {
    const cid = createCorrelationId('API');
    MarketplaceLogger.logMessage('INFO', `Testing Trendyol connection [${cid}]`, {
      marketplaceKey: 'trendyol',
      correlationId: cid,
    });

    const result = await this.connect();
    
    if (result.success) {
      MarketplaceLogger.logMessage('INFO', `✅ Trendyol connection OK [${cid}]`, {
        marketplaceKey: 'trendyol',
        correlationId: cid,
      });
    } else {
      MarketplaceLogger.logMessage('ERROR', `❌ Trendyol connection FAILED: ${result.error?.message} [${cid}]`, {
        marketplaceKey: 'trendyol',
        correlationId: cid,
        error: result.error?.message,
      });
    }

    return {
      success: result.success,
      status: result.status,
      data: result.success,
      duration: result.duration,
      correlationId: cid,
      retryCount: 0,
    };
  }

  // ==================== DOĞRULAMA ====================

  async validate(product: MarketplaceProduct): Promise<MarketplaceResponse<{ valid: boolean; errors: string[] }>> {
    const errors: string[] = [];

    if (!product.sku) errors.push('SKU zorunludur');
    if (!product.title) errors.push('Ürün adı zorunludur');
    if (!product.price || product.price <= 0) errors.push('Geçerli fiyat zorunludur');
    if (product.stock === undefined || product.stock < 0) errors.push('Geçerli stok miktarı zorunludur');
    if (!product.barcode && !product.sku) errors.push('Barkod veya SKU zorunludur');

    return {
      success: errors.length === 0,
      status: errors.length === 0 ? 200 : 400,
      data: {
        valid: errors.length === 0,
        errors,
      },
      duration: 0,
      correlationId: createCorrelationId('API'),
      retryCount: 0,
    };
  }

  // ==================== KATEGORİ & MARKA ====================

  async getCategories(): Promise<MarketplaceResponse<MarketplaceCategory[]>> {
    const cid = createCorrelationId('API');

    try {
      const result = await this.getClient().get<any>(this.apiEndpoint('/categories'), {
        operation: 'getCategories',
        correlationId: cid,
        authHeaders: this.getAuthHeaders(),
      });

      if (!result.success) {
        return createErrorResponse({
          code: 'API_ERROR',
          message: result.error?.message || 'Kategoriler alınamadı',
          httpStatus: result.status,
          duration: result.duration,
          correlationId: cid,
        });
      }

      // Trendyol API yanıtını normalize et
      const categories = this.normalizeCategories(result.data);
      return createSuccessResponse(categories, {
        status: result.status,
        duration: result.duration,
        correlationId: cid,
      });
    } catch (err: any) {
      return createErrorResponse({
        code: 'NETWORK_ERROR',
        message: err.message,
        duration: 0,
        correlationId: cid,
        recoverable: true,
      });
    }
  }

  async getBrands(): Promise<MarketplaceResponse<MarketplaceBrand[]>> {
    const cid = createCorrelationId('API');

    try {
      const result = await this.getClient().get<any>(this.apiEndpoint('/brands'), {
        params: { page: '0', size: '1000' },
        operation: 'getBrands',
        correlationId: cid,
        authHeaders: this.getAuthHeaders(),
      });

      if (!result.success) {
        return createErrorResponse({
          code: 'API_ERROR',
          message: result.error?.message || 'Markalar alınamadı',
          httpStatus: result.status,
          duration: result.duration,
          correlationId: cid,
        });
      }

      const brands = this.normalizeBrands(result.data);
      return createSuccessResponse(brands, {
        status: result.status,
        duration: result.duration,
        correlationId: cid,
      });
    } catch (err: any) {
      return createErrorResponse({
        code: 'NETWORK_ERROR',
        message: err.message,
        duration: 0,
        correlationId: cid,
        recoverable: true,
      });
    }
  }

  // ==================== NORMALİZASYON ====================

  /**
   * Trendyol API kategorilerini ortak formata çevir.
   * Trendyol kategorileri iç içe ağaç yapısındadır.
   */
  private normalizeCategories(apiResponse: any): MarketplaceCategory[] {
    const categories: MarketplaceCategory[] = [];
    
    try {
      const rawCategories = apiResponse?.categories || apiResponse || [];
      const flatten = (items: any[], parentId?: string) => {
        for (const item of items) {
          const cat: MarketplaceCategory = {
            id: String(item.id || item.categoryId || ''),
            name: item.name || item.title || '',
            parentId: parentId,
            path: item.path || '',
          };
          categories.push(cat);
          if (item.subCategories && Array.isArray(item.subCategories)) {
            flatten(item.subCategories, cat.id);
          }
          if (item.children && Array.isArray(item.children)) {
            flatten(item.children, cat.id);
          }
        }
      };
      flatten(rawCategories);
    } catch { /* ham yanıtı olduğu gibi dene */ }

    return categories;
  }

  /**
   * Trendyol API markalarını ortak formata çevir.
   */
  private normalizeBrands(apiResponse: any): MarketplaceBrand[] {
    const brands: MarketplaceBrand[] = [];
    
    try {
      const rawBrands = apiResponse?.brands || apiResponse?.content || [];
      if (Array.isArray(rawBrands)) {
        for (const item of rawBrands) {
          brands.push({
            id: String(item.id || item.brandId || ''),
            name: item.name || item.title || '',
            logo: item.logo || item.logoUrl || undefined,
          });
        }
      }
    } catch { /* boş dizi döndür */ }

    return brands;
  }

  /**
   * API endpoint path'ini oluşturur.
   * Stage: /stagesapigw/suppliers/{supplierId}/...
   * Production: /api/suppliers/{supplierId}/...
   *
   * Ortam bilgisi DB'deki apiUrl'den alınır.
   */
  private apiEndpoint(path: string): string {
    const baseUrl = this.config.baseUrl;
    const isStage = baseUrl.includes('stageapi') || baseUrl.includes('stage');
    const prefix = isStage ? '/stagesapigw' : '/api';
    // Production Trendyol API: /sapigw/suppliers/{id}/...
    const prodPrefix = '/sapigw';
    const finalPrefix = isStage ? prefix : prodPrefix;
    return `${finalPrefix}/suppliers/${this.supplierId}${path}`;
  }

  // ==================== ÜRÜN GÖNDERME (ASYNC BATCH) ====================

  /**
   * Ürün gönder (create/update) - ASENKRON.
   *
   * Akış:
   * 1. Validasyon
   * 2. Trendyol formatına çevir (Mapper)
   * 3. Batch'lere böl (max 50'şerli)
   * 4. Her batch'i POST /products ile gönder → 202 + batchRequestId
   * 5. Polling: GET /products/batch-requests/{id}
   * 6. Sonuçları topla
   * 7. Partial success desteği
   *
   * @param product - Tek ürün (toplu kullanım için BatchScheduler kullanılır)
   */
  async createProduct(product: MarketplaceProduct): Promise<MarketplaceResponse<{ listingId: string }>> {
    const cid = createCorrelationId('API');

    // Validasyon
    const errors = TrendyolProductMapper.validate(product);
    if (errors.length > 0) {
      MarketplaceLogger.logMessage('ERROR', `❌ Product validation failed: ${errors.join(', ')} [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'createProduct', error: errors.join(', '),
      });
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: `Ürün validasyon hatası: ${errors.join(', ')}`,
        httpStatus: 400,
        duration: 0,
        correlationId: cid,
      });
    }

    try {
      const brandId = product.brandId ? parseInt(product.brandId) : 0;
      const categoryId = product.categoryId ? parseInt(product.categoryId) : 0;

      if (!brandId || brandId <= 0) {
        return createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: 'Geçerli brandId zorunludur. Önce marka eşleştirmesi yapın.',
          httpStatus: 400, duration: 0, correlationId: cid,
        });
      }
      if (!categoryId || categoryId <= 0) {
        return createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: 'Geçerli categoryId zorunludur. Önce kategori eşleştirmesi yapın.',
          httpStatus: 400, duration: 0, correlationId: cid,
        });
      }

      // Tek ürünü Trendyol formatına çevir
      const trendyolItem = TrendyolProductMapper.toProductItem(product, {
        brandId, categoryId, vatRate: 20, cargoCompanyId: 0, currencyType: 'TRY',
      });

      MarketplaceLogger.logMessage('INFO', `📦 Sending product ${product.sku} to Trendyol [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'createProduct',
        metadata: { sku: product.sku, barcode: product.barcode, title: product.title },
      });

      // Batch Scheduler ile gönder (tek ürün de olsa batch sistemi kullanılır)
      const scheduler = new TrendyolBatchScheduler(
        this.getClient(),
        this.getAuthHeaders(),
        {
          pollInterval: 5000,
          pollTimeout: 300000,
          maxConcurrent: 3,
          batchSize: 50,
          supplierId: this.supplierId,
          baseUrl: this.config.baseUrl,
        }
      );

      const job = await scheduler.execute([trendyolItem], cid);

      if (job.status === 'SUCCESS' || job.status === 'PARTIAL') {
        const batch = job.batches[0];
        MarketplaceLogger.logMessage('INFO',
          `✅ Product ${product.sku} processed: ${batch.successCount} success, ${batch.errorCount} errors [${cid}]`,
          { marketplaceKey: 'trendyol', correlationId: cid, operation: 'createProduct' }
        );

        return createSuccessResponse({
          listingId: batch.batchRequestId || product.sku,
          batchRequestId: batch.batchRequestId,
          status: job.status,
          successCount: batch.successCount,
          errorCount: batch.errorCount,
          errors: batch.itemErrors,
        } as any, {
          status: job.status === 'SUCCESS' ? 200 : 206,
          duration: Date.now() - job.createdAt,
          correlationId: cid,
          retryCount: batch.pollCount,
        });
      } else {
        return createErrorResponse({
          code: 'BATCH_FAILED',
          message: `Ürün işlenemedi: ${job.totalErrors} hata`,
          httpStatus: 500,
          details: job.batches[0]?.itemErrors,
          duration: Date.now() - job.createdAt,
          correlationId: cid,
        });
      }
    } catch (err: any) {
      MarketplaceLogger.logMessage('ERROR', `❌ Error sending product ${product.sku}: ${err.message} [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'createProduct',
        error: err.message,
      });
      return createErrorResponse({
        code: 'NETWORK_ERROR',
        message: err.message,
        duration: 0, correlationId: cid, recoverable: true,
      });
    }
  }

  /**
   * Ürün güncelle.
   * Trendyol'da create ve update aynı endpoint'tir.
   * Batch sistemi üzerinden çalışır.
   */
  async updateProduct(product: MarketplaceProduct): Promise<MarketplaceResponse<void>> {
    const result = await this.createProduct(product);
    return {
      success: result.success,
      status: result.status,
      duration: result.duration,
      correlationId: result.correlationId,
      retryCount: result.retryCount,
      error: result.error,
    };
  }

  // ==================== STOK GÜNCELLEME ====================

  /**
   * Stok güncelle.
   * POST /stagesapigw/suppliers/{supplierId}/products/stock-update
   *
   * Stock Protection Motoru ile uyumlu çalışır.
   * Correlation ID korunur.
   */
  async updateStock(sku: string, quantity: number, correlationId?: CorrelationId): Promise<MarketplaceResponse<void>> {
    const cid = correlationId || createCorrelationId('API');

    if (quantity < 0) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Stok miktarı negatif olamaz',
        httpStatus: 400,
        duration: 0,
        correlationId: cid,
      });
    }

    if (!sku) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'SKU zorunludur',
        httpStatus: 400,
        duration: 0,
        correlationId: cid,
      });
    }

    try {
      // Stock Protection'dan gelen SKU barkod olabilir, barcode olarak kullan
      const barcode = sku;
      const stockItem = TrendyolProductMapper.toStockItem(barcode, quantity);
      const requestBody = TrendyolProductMapper.toStockRequest([stockItem]);

      MarketplaceLogger.logMessage('INFO', `📦 Updating stock for ${sku}: ${quantity} [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'updateStock',
        metadata: { sku, quantity },
      });

      const result = await this.getClient().post<any>(
        this.apiEndpoint('/products/stock-update'),
        requestBody,
        {
          operation: 'updateStock',
          correlationId: cid,
          authHeaders: this.getAuthHeaders(),
          priority: 'HIGH',
        }
      );

      if (result.success) {
        MarketplaceLogger.logMessage('INFO', `✅ Stock updated for ${sku}: ${quantity} [${cid}]`, {
          marketplaceKey: 'trendyol', correlationId: cid, operation: 'updateStock',
        });
      } else {
        MarketplaceLogger.logMessage('ERROR', `❌ Stock update failed for ${sku}: ${result.error?.message} [${cid}]`, {
          marketplaceKey: 'trendyol', correlationId: cid, operation: 'updateStock',
          error: result.error?.message,
        });
      }

      return {
        success: result.success,
        status: result.status,
        duration: result.duration,
        correlationId: cid,
        retryCount: result.retryCount,
        error: result.error,
      };
    } catch (err: any) {
      MarketplaceLogger.logMessage('ERROR', `❌ Stock update error for ${sku}: ${err.message} [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'updateStock',
        error: err.message,
      });
      return createErrorResponse({
        code: 'NETWORK_ERROR',
        message: err.message,
        duration: 0,
        correlationId: cid,
        recoverable: true,
      });
    }
  }

  // ==================== FİYAT GÜNCELLEME ====================

  /**
   * Fiyat güncelle.
   * POST /stagesapigw/suppliers/{supplierId}/products/price-update
   */
  async updatePrice(sku: string, price: number, currency?: string): Promise<MarketplaceResponse<void>> {
    const cid = createCorrelationId('API');

    if (!sku) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'SKU zorunludur',
        httpStatus: 400,
        duration: 0,
        correlationId: cid,
      });
    }

    if (!price || price <= 0) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Geçerli fiyat zorunludur',
        httpStatus: 400,
        duration: 0,
        correlationId: cid,
      });
    }

    try {
      const barcode = sku;
      const listPrice = price * 1.2;
      const priceItem = TrendyolProductMapper.toPriceItem(barcode, price, Math.round(listPrice * 100) / 100);
      const requestBody = TrendyolProductMapper.toPriceRequest([priceItem]);

      MarketplaceLogger.logMessage('INFO', `💰 Updating price for ${sku}: ${price} ${currency || 'TRY'} [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'updatePrice',
        metadata: { sku, price, currency },
      });

      const result = await this.getClient().post<any>(
        this.apiEndpoint('/products/price-update'),
        requestBody,
        {
          operation: 'updatePrice',
          correlationId: cid,
          authHeaders: this.getAuthHeaders(),
          priority: 'HIGH',
        }
      );

      if (result.success) {
        MarketplaceLogger.logMessage('INFO', `✅ Price updated for ${sku}: ${price} [${cid}]`, {
          marketplaceKey: 'trendyol', correlationId: cid, operation: 'updatePrice',
        });
      } else {
        MarketplaceLogger.logMessage('ERROR', `❌ Price update failed for ${sku}: ${result.error?.message} [${cid}]`, {
          marketplaceKey: 'trendyol', correlationId: cid, operation: 'updatePrice',
          error: result.error?.message,
        });
      }

      return {
        success: result.success,
        status: result.status,
        duration: result.duration,
        correlationId: cid,
        retryCount: result.retryCount,
        error: result.error,
      };
    } catch (err: any) {
      MarketplaceLogger.logMessage('ERROR', `❌ Price update error for ${sku}: ${err.message} [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'updatePrice',
        error: err.message,
      });
      return createErrorResponse({
        code: 'NETWORK_ERROR',
        message: err.message,
        duration: 0,
        correlationId: cid,
        recoverable: true,
      });
    }
  }

  // ==================== NOT IMPLEMENTED ====================

  async deleteProduct(_sku: string): Promise<MarketplaceResponse<void>> {
    throw new MarketplaceError({
      category: 'VALIDATION_ERROR',
      message: 'Trendyol ürün silme henüz implement edilmedi',
      correlationId: createCorrelationId('API'),
      httpStatus: 501,
    });
  }

  async getOrders(_status?: string, _page?: number, _pageSize?: number): Promise<MarketplaceResponse<MarketplaceOrder[]>> {
    throw new MarketplaceError({
      category: 'VALIDATION_ERROR',
      message: 'Trendyol sipariş çekme henüz implement edilmedi',
      correlationId: createCorrelationId('API'),
      httpStatus: 501,
    });
  }

  async updateOrder(_orderNo: string, _status: string): Promise<MarketplaceResponse<void>> {
    throw new MarketplaceError({
      category: 'VALIDATION_ERROR',
      message: 'Trendyol sipariş güncelleme henüz implement edilmedi',
      correlationId: createCorrelationId('API'),
      httpStatus: 501,
    });
  }

  async createShipment(_shipment: MarketplaceShipment): Promise<MarketplaceResponse<void>> {
    throw new MarketplaceError({
      category: 'VALIDATION_ERROR',
      message: 'Trendyol kargo gönderme henüz implement edilmedi',
      correlationId: createCorrelationId('API'),
      httpStatus: 501,
    });
  }

  async cancelOrder(_orderNo: string, _reason?: string): Promise<MarketplaceResponse<void>> {
    throw new MarketplaceError({
      category: 'VALIDATION_ERROR',
      message: 'Trendyol sipariş iptal henüz implement edilmedi',
      correlationId: createCorrelationId('API'),
      httpStatus: 501,
    });
  }
}
