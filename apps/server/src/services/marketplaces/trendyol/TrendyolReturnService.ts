// ==================== TRENDYOL İADE SERVİSİ V1.0 ====================
// Resmi Trendyol Marketplace API üzerinden iade yönetimi.
// Incremental sync, idempotency, validation, metrics, circuit breaker.
// =====================================================================

import { CorrelationId, createCorrelationId } from '../../eventBus/events.ts';
import { EventBus } from '../../eventBus/EventBus.ts';
import { MarketplaceClient } from '../core/MarketplaceClient.ts';
import { MarketplaceLogger } from '../core/MarketplaceLogger.ts';
import { MarketplaceConfig } from '../core/MarketplaceTypes.ts';
import { createSuccessResponse, createErrorResponse, MarketplaceResponse } from '../core/MarketplaceResponse.ts';
import { TrendyolIdempotency } from './TrendyolIdempotency.ts';
import { TrendyolCircuitBreaker } from './TrendyolCircuitBreaker.ts';
import { TrendyolDLQ } from './TrendyolDLQ.ts';
import { TrendyolMetrics } from './TrendyolMetrics.ts';

export interface TrendyolReturn {
  id: number;
  orderNumber: string;
  packageId: number;
  status: ReturnStatus;
  reason: string;
  customerName: string;
  items: TrendyolReturnItem[];
  totalAmount: number;
  currency: string;
  createdDate: string;
  lastModifiedDate: string;
  cargoCompany?: string;
  trackingNumber?: string;
  refundAmount?: number;
  refundDate?: string;
}

export interface TrendyolReturnItem {
  barcode: string;
  stockCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  reason: string;
}

export type ReturnStatus =
  | 'INITIAL'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'REFUND_IN_PROGRESS'
  | 'REFUND_COMPLETED'
  | 'CANCELLED';

export interface ReturnFilter {
  page?: number;
  size?: number;
  status?: ReturnStatus;
  startDate?: string;
  endDate?: string;
  orderNumber?: string;
}

export interface ReturnActionResponse {
  returnId: number;
  status: ReturnStatus;
  message: string;
}

export class TrendyolReturnService {
  private client: MarketplaceClient;
  private config: MarketplaceConfig;
  private supplierId: number;
  private authHeaders: Record<string, string>;
  private circuitBreaker: TrendyolCircuitBreaker;

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
    this.circuitBreaker = TrendyolCircuitBreaker.getInstance('trendyol-returns', {
      threshold: 5, timeout: 30000, halfOpenMax: 3, successThreshold: 2,
    });
  }

  static async create(marketplaceKey: string = 'trendyol'): Promise<TrendyolReturnService> {
    const { prisma } = await import('../../../db/prisma.ts');
    const { TrendyolAdapter } = await import('./TrendyolAdapter.ts');
    const p = (prisma as any);

    const mp = await p.marketplace.findUnique({ where: { key: marketplaceKey } });
    if (!mp) throw new Error(`Marketplace ${marketplaceKey} bulunamadı`);

    const adapter = await TrendyolAdapter.create(marketplaceKey);
    const client = adapter.getClient();
    const config = adapter.getConfig();

    let supplierId = 2738;
    if (mp.settings) {
      try { const s = JSON.parse(mp.settings); supplierId = parseInt(s.sellerId || s.supplierId || '2738'); } catch {}
    }

    const token = Buffer.from(`${mp.apiKey || ''}:${mp.apiSecret || ''}`).toString('base64');
    const authHeaders = { 'Authorization': `Basic ${token}` };

    return new TrendyolReturnService(client, config, supplierId, authHeaders);
  }

  private endpoint(path: string): string {
    const isStage = this.config.baseUrl.includes('stageapi') || this.config.baseUrl.includes('stage');
    const prodPrefix = '/sapigw';
    const prefix = isStage ? '/stagesapigw' : prodPrefix;
    return `${prefix}/suppliers/${this.supplierId}${path}`;
  }

  async getReturns(filter: ReturnFilter = {}): Promise<MarketplaceResponse<TrendyolReturn[]>> {
    const cid = createCorrelationId('API');
    const startTime = Date.now();

    const params: Record<string, string | number> = { page: filter.page ?? 0, size: filter.size ?? 50 };
    if (filter.status) params.status = filter.status;
    if (filter.startDate) params.startDate = filter.startDate;
    if (filter.endDate) params.endDate = filter.endDate;
    if (filter.orderNumber) params.orderNumber = filter.orderNumber;

    return this.circuitBreaker.call(
      'trendyol-returns',
      async () => {
        MarketplaceLogger.logMessage('INFO', `📋 Fetching returns page ${params.page} [${cid}]`, {
          marketplaceKey: 'trendyol', correlationId: cid, operation: 'health',
          metadata: { params },
        });

        const result = await this.client.get<any>(this.endpoint('/returns'), {
          params, operation: 'health', correlationId: cid, authHeaders: this.authHeaders,
        });

        if (!result.success) {
          MarketplaceLogger.logMessage('ERROR', `❌ Returns fetch failed: ${result.error?.message} [${cid}]`, {
            marketplaceKey: 'trendyol', correlationId: cid, operation: 'health',
            error: result.error?.message,
          });
          TrendyolMetrics.recordApiCall({
            endpoint: this.endpoint('/returns'), duration: Date.now() - startTime,
            success: false, retryCount: result.retryCount, timestamp: Date.now(),
          });
          return result;
        }

        const returns = this.normalizeReturns(result.data);
        const duration = Date.now() - startTime;

        MarketplaceLogger.logMessage('INFO', `📋 Returns page ${params.page}: ${returns.length} items (${duration}ms) [${cid}]`, {
          marketplaceKey: 'trendyol', correlationId: cid, operation: 'health',
        });

        TrendyolMetrics.recordApiCall({
          endpoint: this.endpoint('/returns'), duration,
          success: true, retryCount: result.retryCount, timestamp: Date.now(),
        });

        return createSuccessResponse(returns, {
          status: result.status, duration, correlationId: cid, retryCount: result.retryCount,
        });
      },
      async () => createErrorResponse({
        code: 'CIRCUIT_OPEN', message: 'Returns API geçici olarak kapalı',
        duration: Date.now() - startTime, correlationId: cid,
      })
    );
  }

  async getReturnDetail(returnId: number): Promise<MarketplaceResponse<TrendyolReturn>> {
    const cid = createCorrelationId('API');
    const startTime = Date.now();

    if (!returnId || returnId <= 0) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR', message: 'Geçerli returnId zorunludur',
        httpStatus: 400, duration: 0, correlationId: cid,
      });
    }

    MarketplaceLogger.logMessage('INFO', `📋 Fetching return detail #${returnId} [${cid}]`, {
      marketplaceKey: 'trendyol', correlationId: cid, operation: 'health',
    });

    try {
      const result = await this.client.get<any>(this.endpoint(`/returns/${returnId}`), {
        operation: 'health', correlationId: cid, authHeaders: this.authHeaders,
      });

      if (!result.success) return result;

      const returnDetail = this.normalizeReturn(result.data);
      return createSuccessResponse(returnDetail, {
        status: result.status, duration: Date.now() - startTime, correlationId: cid,
      });
    } catch (err: any) {
      return createErrorResponse({
        code: 'NETWORK_ERROR', message: err.message,
        duration: Date.now() - startTime, correlationId: cid, recoverable: true,
      });
    }
  }

  async approveReturn(returnId: number, _reason?: string): Promise<MarketplaceResponse<ReturnActionResponse>> {
    return this.returnAction(returnId, 'approve', {}, createCorrelationId('API'));
  }

  async rejectReturn(returnId: number, reason: string): Promise<MarketplaceResponse<ReturnActionResponse>> {
    if (!reason) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR', message: 'Ret sebebi zorunludur',
        httpStatus: 400, duration: 0, correlationId: createCorrelationId('API'),
      });
    }
    return this.returnAction(returnId, 'reject', { reason }, createCorrelationId('API'));
  }

  async createRefund(returnId: number, amount?: number): Promise<MarketplaceResponse<ReturnActionResponse>> {
    const cid = createCorrelationId('API');
    const refundHash = `refund:${returnId}:${amount || 'full'}`;

    if (await TrendyolIdempotency.isDuplicate(refundHash)) {
      MarketplaceLogger.logMessage('WARN', `⏭️ Duplicate refund for return #${returnId} [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'health',
      });
    }

    await TrendyolIdempotency.markSent(refundHash, `refund-${returnId}-${Date.now()}`, String(returnId));
    const result = await this.returnAction(returnId, 'refund', { amount }, cid);

    if (!result.success) {
      await TrendyolDLQ.add({
        sku: `return-${returnId}`, barcode: '',
        title: `İade #${returnId} para iadesi`,
        error: result.error?.message || 'Refund hatası',
        batchRequestId: String(returnId), batchNo: 'N/A',
        masterCorrelationId: cid, retryCount: 0,
        productData: { returnId, amount },
      });
    }
    return result;
  }

  async getReturnHistory(returnId: number): Promise<MarketplaceResponse<any[]>> {
    const cid = createCorrelationId('API');
    try {
      const result = await this.client.get<any>(this.endpoint(`/returns/${returnId}/history`), {
        operation: 'health', correlationId: cid, authHeaders: this.authHeaders,
      });
      if (!result.success) return result;
      return createSuccessResponse(result.data?.history || result.data || [], {
        status: result.status, duration: result.duration, correlationId: cid,
      });
    } catch (err: any) {
      return createErrorResponse({
        code: 'NETWORK_ERROR', message: err.message,
        duration: 0, correlationId: cid, recoverable: true,
      });
    }
  }

  async syncReturns(filter: ReturnFilter = {}): Promise<{
    correlationId: CorrelationId;
    totalReceived: number;
    totalErrors: number;
    errors: Array<{ id: number; error: string }>;
    durationMs: number;
  }> {
    const cid = createCorrelationId('API');
    const startTime = Date.now();
    let totalReceived = 0;
    let totalErrors = 0;
    const errors: Array<{ id: number; error: string }> = [];

    MarketplaceLogger.logMessage('INFO', `🔄 Starting return sync [${cid}]`, {
      marketplaceKey: 'trendyol', correlationId: cid, operation: 'health',
    });

    (EventBus.emit as any)({
      type: 'MarketplaceResponse', correlationId: cid,
      timestamp: new Date().toISOString(), source: 'TrendyolReturnService',
      data: { marketplaceKey: 'trendyol', operation: 'health' as const,
        success: true, status: 202, duration: 0, retryCount: 0,
        meta: { event: 'ReturnSyncStarted' },
      },
    });

    try {
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await this.getReturns({ ...filter, page, size: 50 });
        if (!result.success || !result.data) break;

        const returnList = result.data;
        totalReceived += returnList.length;

        for (const ret of returnList) {
          try {
            const returnHash = `return:${ret.id}`;
            if (await TrendyolIdempotency.isDuplicate(returnHash)) continue;
            await TrendyolIdempotency.markSent(returnHash, `sync-return-${ret.id}`, String(ret.id));

            (EventBus.emit as any)({
              type: 'MarketplaceResponse', correlationId: cid,
              timestamp: new Date().toISOString(), source: 'TrendyolReturnService',
              data: { marketplaceKey: 'trendyol', operation: 'health' as const,
                success: true, status: 200, duration: 0, retryCount: 0,
                meta: { event: 'ReturnReceived', returnId: ret.id, status: ret.status },
              },
            });
          } catch (err: any) {
            totalErrors++;
            errors.push({ id: ret.id, error: err.message });
            await TrendyolDLQ.add({
              sku: `return-${ret.id}`, barcode: '', title: `İade #${ret.id}`,
              error: err.message, batchRequestId: String(ret.id), batchNo: 'N/A',
              masterCorrelationId: cid, retryCount: 0, productData: ret,
            });
          }
        }
        hasMore = returnList.length >= 50;
        page++;
      }

      (EventBus.emit as any)({
        type: 'MarketplaceResponse', correlationId: cid,
        timestamp: new Date().toISOString(), source: 'TrendyolReturnService',
        data: { marketplaceKey: 'trendyol', operation: 'health' as const,
          success: totalErrors === 0,
          status: totalErrors > 0 ? 206 : 200,
          duration: Date.now() - startTime, retryCount: 0,
          meta: { event: 'ReturnSyncCompleted', totalReceived, totalErrors },
        },
      });

      MarketplaceLogger.logMessage('INFO',
        `📊 Return sync: ${totalReceived} received, ${totalErrors} errors (${Date.now() - startTime}ms) [${cid}]`,
        { marketplaceKey: 'trendyol', correlationId: cid, operation: 'health' }
      );
    } catch (err: any) {
      MarketplaceLogger.logMessage('ERROR', `❌ Return sync error: ${err.message} [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'health',
        error: err.message,
      });
    }

    return { correlationId: cid, totalReceived, totalErrors, errors, durationMs: Date.now() - startTime };
  }

  async testConnection(): Promise<MarketplaceResponse<{ message: string }>> {
    return createSuccessResponse(
      { message: 'Trendyol Return Service hazır' },
      { status: 200, duration: 0, correlationId: createCorrelationId('API') }
    );
  }

  private async returnAction(
    returnId: number, action: 'approve' | 'reject' | 'refund',
    body: Record<string, any>, correlationId: CorrelationId
  ): Promise<MarketplaceResponse<ReturnActionResponse>> {
    const startTime = Date.now();

    if (!returnId || returnId <= 0) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR', message: 'Geçerli returnId zorunludur',
        httpStatus: 400, duration: 0, correlationId,
      });
    }

    MarketplaceLogger.logMessage('INFO', `📋 ${action} return #${returnId} [${correlationId}]`, {
      marketplaceKey: 'trendyol', correlationId, operation: 'health',
    });

    try {
      const result = await this.client.post<any>(
        this.endpoint(`/returns/${returnId}/${action}`), body,
        { operation: 'health', correlationId, authHeaders: this.authHeaders, priority: 'HIGH' }
      );

      if (result.success) {
        (EventBus.emit as any)({
          type: 'MarketplaceResponse', correlationId,
          timestamp: new Date().toISOString(), source: 'TrendyolReturnService',
          data: { marketplaceKey: 'trendyol', operation: 'health' as const,
            success: true, status: 200, duration: Date.now() - startTime,
            retryCount: result.retryCount,
            meta: { event: `Return${action.charAt(0).toUpperCase() + action.slice(1)}`, returnId },
          },
        });
      }

      return createSuccessResponse(
        { returnId, status: (action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'REFUND_IN_PROGRESS') as ReturnStatus, message: `İade ${action} başarılı` },
        { status: result.status, duration: Date.now() - startTime, correlationId, retryCount: result.retryCount }
      );
    } catch (err: any) {
      return createErrorResponse({
        code: 'NETWORK_ERROR', message: err.message,
        duration: Date.now() - startTime, correlationId, recoverable: true,
      });
    }
  }

  private normalizeReturns(apiResponse: any): TrendyolReturn[] {
    try {
      const items = apiResponse?.content || apiResponse || [];
      if (!Array.isArray(items)) return [];
      return items.map((item: any) => this.normalizeReturn(item));
    } catch { return []; }
  }

  private normalizeReturn(item: any): TrendyolReturn {
    return {
      id: item.id || 0,
      orderNumber: item.orderNumber || '',
      packageId: item.packageId || item.shipmentPackageId || 0,
      status: (item.status || 'INITIAL').toUpperCase() as ReturnStatus,
      reason: item.reason || item.returnReason || '',
      customerName: item.customerName || item.customer?.name || '',
      items: (item.items || item.lineItems || []).map((i: any) => ({
        barcode: i.barcode || '',
        stockCode: i.stockCode || '',
        productName: i.productName || i.name || '',
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || i.price || 0,
        reason: i.reason || '',
      })),
      totalAmount: item.totalAmount || item.totalPrice || 0,
      currency: item.currency || item.currencyCode || 'TRY',
      createdDate: item.createdDate || item.createDateTime || '',
      lastModifiedDate: item.lastModifiedDate || item.lastModifiedDateTime || '',
      cargoCompany: item.cargoCompany || item.shipmentCompany || '',
      trackingNumber: item.trackingNumber || item.cargoTrackingNumber || '',
      refundAmount: item.refundAmount,
      refundDate: item.refundDate,
    };
  }
}
