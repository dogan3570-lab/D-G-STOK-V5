// ==================== TRENDYOL SİPARİŞ SERVİSİ V1.0 ====================
// resmi Trendyol Marketplace API üzerinden sipariş yönetimi.
// Incremental sync, scheduler, idempotency, validation, metrics.
// =====================================================================

import { prisma } from '../../../db/prisma.ts';
import { createCorrelationId, CorrelationId } from '../../eventBus/events.ts';
import { EventBus } from '../../eventBus/EventBus.ts';
import { MarketplaceClient } from '../core/MarketplaceClient.ts';
import { MarketplaceLogger } from '../core/MarketplaceLogger.ts';
import { MarketplaceConfig, MarketplaceOrder } from '../core/MarketplaceTypes.ts';
import { createSuccessResponse, createErrorResponse, MarketplaceResponse } from '../core/MarketplaceResponse.ts';
import { TrendyolOrderMapper, TrendyolOrdersResponse } from './TrendyolOrderMapper.ts';
import { TrendyolIdempotency } from './TrendyolIdempotency.ts';
import { TrendyolMetrics } from './TrendyolMetrics.ts';

const p = prisma as any;

// ==================== TİPLER ====================

export interface OrderSyncOptions {
  page?: number;
  size?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  shipmentPackageStatus?: string;
}

export interface OrderSyncResult {
  correlationId: CorrelationId;
  totalReceived: number;
  totalNew: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  errors: Array<{ orderNumber: string; error: string }>;
  durationMs: number;
  pagesProcessed: number;
}

export interface OrderMetrics {
  ordersPerMinute: number;
  averageSyncDuration: number;
  failedOrders: number;
  duplicateOrders: number;
  skippedOrders: number;
  lastSyncAt: string | null;
  totalOrders: number;
}

// ==================== ORDER SERVICE ====================

/**
 * Trendyol Sipariş Servisi.
 * 
 * Kullanım:
 * ```typescript
 * const service = await TrendyolOrderService.create('trendyol');
 * const result = await service.syncOrders({ startDate: '2026-01-01' });
 * ```
 */
export class TrendyolOrderService {
  private client: MarketplaceClient;
  private config: MarketplaceConfig;
  private supplierId: number;
  private authHeaders: Record<string, string>;
  private syncLock = false;
  private syncHistory: OrderSyncResult[] = [];
  private static readonly MAX_HISTORY = 100;
  private duplicateOrders = 0;
  private skippedOrders = 0;

  private constructor(
    client: MarketplaceClient,
    config: MarketplaceConfig,
    supplierId: number,
    authHeaders: Record<string, string>
  ) {
    this.client = client;
    this.config = config;
    this.supplierId = supplierId;
    this.authHeaders = authHeaders;
  }

  /**
   * TrendyolOrderService instance'ı oluştur.
   */
  static async create(marketplaceKey: string = 'trendyol'): Promise<TrendyolOrderService> {
    const { TrendyolAdapter } = await import('./TrendyolAdapter.ts');
    const adapter = await TrendyolAdapter.create(marketplaceKey);
    const client = adapter.getClient();
    const config = adapter.getConfig();

    // Auth headers
    const mp = await p.marketplace.findUnique({
      where: { key: marketplaceKey },
      select: { apiKey: true, apiSecret: true, settings: true },
    });

    let supplierId = 2738;
    if (mp?.settings) {
      try { const s = JSON.parse(mp.settings); supplierId = parseInt(s.sellerId || s.supplierId || '2738'); } catch {}
    }

    const token = Buffer.from(`${mp?.apiKey || ''}:${mp?.apiSecret || ''}`).toString('base64');
    const authHeaders = { 'Authorization': `Basic ${token}` };

    return new TrendyolOrderService(client, config, supplierId, authHeaders);
  }

  /**
   * Siparişlerin endpoint path'ini oluştur (stage/prod farkı).
   */
  private ordersEndpoint(path: string = ''): string {
    const isStage = this.config.baseUrl.includes('stageapi') || this.config.baseUrl.includes('stage');
    const prodPrefix = '/sapigw';
    const prefix = isStage ? '/stagesapigw' : prodPrefix;
    return `${prefix}/suppliers/${this.supplierId}/orders${path}`;
  }

  // ==================== ANA METOT ====================

  /**
   * Siparişleri getir (senkron, sayfalı).
   * 
   * Filter options:
   * - page, size: Sayfalama
   * - status: Sipariş durumu filtresi (NEW, PICKING, SHIPPED, ...)
   * - startDate, endDate: Tarih aralığı (ISO 8601)
   * - shipmentPackageStatus: Kargo durumu
   */
  async getOrders(options: OrderSyncOptions = {}): Promise<MarketplaceResponse<MarketplaceOrder[]>> {
    const cid = createCorrelationId('API');
    const startTime = Date.now();

    const params: Record<string, string | number> = {
      page: options.page ?? 0,
      size: options.size ?? 100,
    };
    if (options.status) params.status = options.status;
    if (options.startDate) params.startDate = options.startDate;
    if (options.endDate) params.endDate = options.endDate;
    if (options.shipmentPackageStatus) params.shipmentPackageStatus = options.shipmentPackageStatus;

    MarketplaceLogger.logMessage('INFO', `📋 Fetching orders page ${params.page} [${cid}]`, {
      marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders',
      metadata: { params },
    });

    try {
      const result = await this.client.get<any>(this.ordersEndpoint(), {
        params,
        operation: 'getOrders',
        correlationId: cid,
        authHeaders: this.authHeaders,
      });

      if (!result.success) {
        MarketplaceLogger.logMessage('ERROR', `❌ Orders fetch failed: ${result.error?.message} [${cid}]`, {
          marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders',
          error: result.error?.message,
        });
        return result;
      }

      // Parse et
      const parsed = TrendyolOrderMapper.parseOrdersResponse(result.data);
      const duration = Date.now() - startTime;

      MarketplaceLogger.logMessage('INFO',
        `📋 Orders page ${options.page ?? 0}: ${parsed.orders.length} orders (${duration}ms) [${cid}]`,
        { marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders' }
      );

      // Metrics
      TrendyolMetrics.recordApiCall({
        endpoint: this.ordersEndpoint(),
        duration,
        success: true,
        retryCount: result.retryCount,
        timestamp: Date.now(),
      });

      return createSuccessResponse(parsed.orders, {
        status: result.status,
        duration,
        correlationId: cid,
        retryCount: result.retryCount,
        raw: { totalElements: parsed.totalElements, totalPages: parsed.totalPages },
      });

    } catch (err: any) {
      MarketplaceLogger.logMessage('ERROR', `❌ Orders fetch error: ${err.message} [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders',
        error: err.message,
      });

      TrendyolMetrics.recordApiCall({
        endpoint: this.ordersEndpoint(),
        duration: Date.now() - startTime,
        success: false,
        retryCount: 0,
        timestamp: Date.now(),
      });

      return createErrorResponse({
        code: 'NETWORK_ERROR',
        message: err.message,
        duration: Date.now() - startTime,
        correlationId: cid,
        recoverable: true,
      });
    }
  }

  // ==================== INCREMENTAL SYNC ====================

  /**
   * Incremental sync yap.
   * İlk çalıştırmada son 90 günü çeker.
   * Sonraki çalıştırmalarda son sync tarihinden itibaren çeker.
   * Idempotency ile aynı sipariş ikinci kez işlenmez.
   */
  async syncOrders(options: OrderSyncOptions = {}): Promise<OrderSyncResult> {
    const cid = createCorrelationId('API');
    const startTime = Date.now();

    // Sync lock
    if (this.syncLock) {
      MarketplaceLogger.logMessage('WARN', `⏭️ Sync already in progress, skipping [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders',
      });
      return {
        correlationId: cid,
        totalReceived: 0, totalNew: 0, totalUpdated: 0,
        totalSkipped: 0, totalErrors: 0, errors: [],
        durationMs: 0, pagesProcessed: 0,
      };
    }

    this.syncLock = true;
    this.duplicateOrders = 0;
    this.skippedOrders = 0;

    try {
      // Event: Sync başladı
      (EventBus.emit as any)({
        type: 'MarketplaceResponse', correlationId: cid,
        timestamp: new Date().toISOString(), source: 'TrendyolOrderService',
        data: {
          marketplaceKey: 'trendyol', operation: 'getOrders',
          success: true, status: 202, duration: 0, retryCount: 0,
          meta: { event: 'OrderSyncStarted', startDate: options.startDate },
        },
      });

      // Son sync tarihini bul
      const lastSync = await this.getLastSyncDate();
      const startDate = options.startDate || lastSync || this.getDefaultStartDate();

      let page = 0;
      let totalPages = 1;
      let totalReceived = 0;
      let totalNew = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      const errors: Array<{ orderNumber: string; error: string }> = [];

      // Sayfalı çek
      while (page < totalPages) {
        const result = await this.getOrders({
          ...options,
          page,
          size: options.size || 100,
          startDate,
          endDate: options.endDate,
        });

        if (!result.success) {
          MarketplaceLogger.logMessage('ERROR', `❌ Sync failed at page ${page}: ${result.error?.message} [${cid}]`, {
            marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders',
          });
          totalErrors++;
          errors.push({ orderNumber: `page-${page}`, error: result.error?.message || 'Sync hatası' });
          break;
        }

        const orders = result.data || [];
        totalReceived += orders.length;

        // Her siparişi işle
        for (const order of orders) {
          try {
            // Idempotency: Aynı order number daha önce işlendi mi?
            const orderHash = `order:${order.orderNo}`;
            const isDuplicate = await TrendyolIdempotency.isDuplicate(orderHash);
            
            if (isDuplicate) {
              this.duplicateOrders++;
              // Event: Skipped
              (EventBus.emit as any)({
                type: 'MarketplaceResponse', correlationId: cid,
                timestamp: new Date().toISOString(), source: 'TrendyolOrderService',
                data: {
                  marketplaceKey: 'trendyol', operation: 'getOrders',
                  success: true, status: 200, duration: 0, retryCount: 0,
                  meta: { event: 'OrderSkipped', orderNo: order.orderNo, reason: 'duplicate' },
                },
              });
              continue;
            }

            // Validasyon
            const validationErrors = TrendyolOrderMapper.validate({
              orderNumber: order.orderNo,
              ...order,
            });

            if (validationErrors.length > 0) {
              this.skippedOrders++;
              totalErrors++;
              errors.push({ orderNumber: order.orderNo, error: validationErrors.join(', ') });
              MarketplaceLogger.logMessage('WARN', `⚠️ Order ${order.orderNo} validation failed: ${validationErrors.join(', ')} [${cid}]`, {
                marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders',
              });
              continue;
            }

            // Idempotency: İşlendi olarak işaretle
            await TrendyolIdempotency.markSent(orderHash, `sync-${order.orderNo}`, order.orderNo);

            // DB'ye kaydet (varsa güncelle, yoksa oluştur)
            await this.upsertOrder(order, cid);

            totalNew++;
            totalUpdated++;

            // Event: Order received/updated
            (EventBus.emit as any)({
              type: 'MarketplaceResponse', correlationId: cid,
              timestamp: new Date().toISOString(), source: 'TrendyolOrderService',
              data: {
                marketplaceKey: 'trendyol', operation: 'getOrders',
                success: true, status: 200, duration: 0, retryCount: 0,
                meta: { event: 'OrderReceived', orderNo: order.orderNo },
              },
            });

          } catch (err: any) {
            totalErrors++;
            errors.push({ orderNumber: order.orderNo, error: err.message });
            MarketplaceLogger.logMessage('ERROR', `❌ Order ${order.orderNo} processing error: ${err.message} [${cid}]`, {
              marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders',
              error: err.message,
            });
          }
        }

        // Sayfalama
        const responseData = (result as any).raw;
        totalPages = responseData?.totalPages || 1;
        page++;
      }

      // Son sync tarihini güncelle
      await this.updateLastSyncDate(new Date().toISOString());

      const result: OrderSyncResult = {
        correlationId: cid,
        totalReceived,
        totalNew,
        totalUpdated,
        totalSkipped: this.skippedOrders + this.duplicateOrders,
        totalErrors,
        errors,
        durationMs: Date.now() - startTime,
        pagesProcessed: page,
      };

      // History
      this.syncHistory.push(result);
      if (this.syncHistory.length > TrendyolOrderService.MAX_HISTORY) {
        this.syncHistory.shift();
      }

      // Event: Sync completed
      (EventBus.emit as any)({
        type: 'MarketplaceResponse', correlationId: cid,
        timestamp: new Date().toISOString(), source: 'TrendyolOrderService',
        data: {
          marketplaceKey: 'trendyol', operation: 'getOrders',
          success: result.totalErrors === 0,
          status: result.totalErrors > 0 ? 206 : 200,
          duration: result.durationMs, retryCount: 0,
          meta: { event: 'OrderSyncCompleted', ...result },
        },
      });

      MarketplaceLogger.logMessage('INFO',
        `📊 Sync completed: ${result.totalNew} new, ${result.totalUpdated} updated, ` +
        `${result.totalSkipped} skipped, ${result.totalErrors} errors (${result.durationMs}ms) [${cid}]`,
        { marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders' }
      );

      return result;

    } finally {
      this.syncLock = false;
    }
  }

  // ==================== DB İŞLEMLERİ ====================

  /**
   * Siparişi DB'ye kaydet (upsert).
   * Aynı orderNo varsa güncelle, yoksa oluştur.
   */
  private async upsertOrder(order: MarketplaceOrder, correlationId: CorrelationId): Promise<void> {
    const existing = await p.order.findUnique({ where: { orderNo: order.orderNo } });

    if (existing) {
      await p.order.update({
        where: { orderNo: order.orderNo },
        data: {
          status: order.status,
          customerName: order.customerName,
          items: JSON.stringify(order.items),
          total: order.total,
          cargoCompany: order.cargoCompany,
          trackingNo: order.trackingNo,
        },
      });
    } else {
      await p.order.create({
        data: {
          orderNo: order.orderNo,
          channel: 'trendyol',
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          address: order.address,
          city: order.city,
          district: order.district,
          cargoCompany: order.cargoCompany,
          trackingNo: order.trackingNo,
          status: order.status,
          total: order.total,
          items: JSON.stringify(order.items),
        },
      });
    }
  }

  /**
   * Son senkron tarihini al.
   */
  private async getLastSyncDate(): Promise<string | null> {
    try {
      const setting = await p.setting.findUnique({ where: { key: 'trendyol_last_order_sync' } });
      return setting?.value || null;
    } catch {
      return null;
    }
  }

  /**
   * Son senkron tarihini güncelle.
   */
  private async updateLastSyncDate(dateStr: string): Promise<void> {
    try {
      await p.setting.upsert({
        where: { key: 'trendyol_last_order_sync' },
        update: { value: dateStr },
        create: { key: 'trendyol_last_order_sync', value: dateStr },
      });
    } catch { /* ignore */ }
  }

  /**
   * Varsayılan başlangıç tarihi (son 90 gün).
   */
  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString();
  }

  // ==================== METRICS ====================

  /**
   * Sipariş metriklerini getir.
   */
  async getMetrics(): Promise<MarketplaceResponse<OrderMetrics>> {
    const totalOrders = await p.order.count({ where: { channel: 'trendyol' } }).catch(() => 0);
    const lastSync = await this.getLastSyncDate();

    const recentSyncs = this.syncHistory.slice(-5);
    const avgDuration = recentSyncs.length > 0
      ? Math.round(recentSyncs.reduce((s, r) => s + r.durationMs, 0) / recentSyncs.length)
      : 0;

    const lastMinOrders = this.syncHistory
      .filter(r => r.durationMs > 0 && (Date.now() - (r.durationMs + startOffset())) < 60000)
      .reduce((s, r) => s + r.totalReceived, 0);

    // Safe start time calculation
    function startOffset(): number {
      return 0;
    }

    const metrics: OrderMetrics = {
      ordersPerMinute: lastMinOrders || 0,
      averageSyncDuration: avgDuration,
      failedOrders: this.syncHistory.reduce((s, r) => s + r.totalErrors, 0),
      duplicateOrders: this.duplicateOrders,
      skippedOrders: this.skippedOrders,
      lastSyncAt: lastSync,
      totalOrders,
    };

    return createSuccessResponse(metrics, {
      status: 200,
      duration: 0,
      correlationId: createCorrelationId('API'),
    });
  }

  /**
   * Sync geçmişini getir.
   */
  async getHistory(limit: number = 20): Promise<MarketplaceResponse<OrderSyncResult[]>> {
    return createSuccessResponse(this.syncHistory.slice(-limit), {
      status: 200,
      duration: 0,
      correlationId: createCorrelationId('API'),
    });
  }

  /**
   * Test amaçlı tek sayfa sipariş çek.
   */
  async testConnection(): Promise<MarketplaceResponse<{ success: boolean; ordersCount: number }>> {
    const result = await this.getOrders({ page: 0, size: 5 });
    return {
      success: result.success,
      status: result.status,
      data: { success: result.success, ordersCount: result.data?.length || 0 },
      duration: result.duration,
      correlationId: result.correlationId,
      retryCount: result.retryCount,
    };
  }

  /** Lock durumu */
  get isSyncing(): boolean { return this.syncLock; }
}
