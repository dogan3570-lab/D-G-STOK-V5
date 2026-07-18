// ==================== TRENDYOL BATCH SERVICE V1.0 ====================
// Product Create için batch scheduler + polling mekanizması.
//
// Akış:
//   POST /products → 202 Accepted + batchRequestId
//       ↓
//   Polling: GET /products/batch-requests/{batchRequestId}
//       ↓ (her 5 saniyede bir)
//   Status: WAITING → PROCESSING → SUCCESS | FAILED
//       ↓
//   EventBus'a event yayınla
//       ↓
//   Sonuç raporu
// =====================================================================

import { EventBus } from '../../eventBus/EventBus.ts';
import { createCorrelationId, CorrelationId } from '../../eventBus/events.ts';
import { MarketplaceClient } from '../core/MarketplaceClient.ts';
import { MarketplaceLogger } from '../core/MarketplaceLogger.ts';
import { TrendyolProductMapper, TrendyolProductItem } from './TrendyolProductMapper.ts';

// ==================== TİPLER ====================

export type BatchStatus = 'WAITING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';

export interface BatchInfo {
  /** Batch sıra numarası (01, 02, ...) */
  batchNo: string;
  /** Trendyol'dan dönen batch request ID */
  batchRequestId: string;
  /** Kaç ürün içeriyor */
  itemCount: number;
  /** Güncel durum */
  status: BatchStatus;
  /** Trendyol'dan dönen ham durum */
  rawStatus: string;
  /** Kaç kez poll edildi */
  pollCount: number;
  /** Başlangıç zamanı */
  startedAt: number;
  /** Bitiş zamanı */
  finishedAt?: number;
  /** Başarılı ürün sayısı */
  successCount: number;
  /** Hatalı ürün sayısı */
  errorCount: number;
  /** Ürün bazlı hatalar (SKU → hata) */
  itemErrors: Array<{ sku: string; barcode: string; error: string }>;
  /** Correlation ID (ana ID'ye bağlı) */
  correlationId: string;
}

export interface BatchJob {
  /** Ana correlation ID */
  masterCorrelationId: CorrelationId;
  /** Tüm batch'ler */
  batches: BatchInfo[];
  /** Toplam ürün */
  totalItems: number;
  /** Toplam başarılı */
  totalSuccess: number;
  /** Toplam hatalı */
  totalErrors: number;
  /** Genel durum */
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
  /** Oluşturulma zamanı */
  createdAt: number;
}

export interface BatchSchedulerConfig {
  /** Polling aralığı (ms) */
  pollInterval: number;
  /** Polling timeout (ms) - bu sürede sonuç gelmezse TIMEOUT */
  pollTimeout: number;
  /** Maksimum eşzamanlı batch */
  maxConcurrent: number;
  /** Batch başına max ürün */
  batchSize: number;
}

const DEFAULT_CONFIG: BatchSchedulerConfig = {
  pollInterval: 5000,
  pollTimeout: 300000, // 5 dk
  maxConcurrent: 3,
  batchSize: 50,
};

// ==================== POLLING SERVİSİ ====================

/**
 * Tek bir batch için polling yapar.
 * Belirli aralıklarla GET /products/batch-requests/{id} sorgular.
 * 
 * @param client - MarketplaceClient instance
 * @param batchRequestId - Trendyol batch request ID
 * @param config - Polling yapılandırması
 * @param correlationId - Correlation ID
 * @param authHeaders - Authorization headers
 * @param onStatusChange - Durum değişikliğinde callback
 * @returns BatchInfo - Nihai batch durumu
 */
export async function pollBatchRequest(
  client: MarketplaceClient,
  batchRequestId: string,
  config: BatchSchedulerConfig,
  correlationId: CorrelationId,
  authHeaders: Record<string, string>,
  onStatusChange?: (status: BatchStatus, info: Partial<BatchInfo>) => void
): Promise<BatchInfo> {
  const startTime = Date.now();
  let pollCount = 0;
  let currentStatus: BatchStatus = 'WAITING';
  let itemErrors: Array<{ sku: string; barcode: string; error: string }> = [];
  let successCount = 0;
  let errorCount = 0;
  let itemCount = 0;

  const statusEndpoint = `/products/batch-requests/${batchRequestId}`;

  MarketplaceLogger.logMessage('INFO', `🔍 Polling started for batch ${batchRequestId} [${correlationId}]`, {
    marketplaceKey: 'trendyol', correlationId, operation: 'createProduct',
  });

  while (true) {
    // Timeout kontrolü
    if (Date.now() - startTime > config.pollTimeout) {
      currentStatus = 'TIMEOUT';
      MarketplaceLogger.logMessage('ERROR', `⏰ Polling timeout for batch ${batchRequestId} [${correlationId}]`, {
        marketplaceKey: 'trendyol', correlationId, operation: 'createProduct',
      });
      break;
    }

    pollCount++;

    try {
      const result = await client.get<any>(statusEndpoint, {
        operation: 'createProduct',
        correlationId,
        authHeaders,
        priority: 'HIGH',
      });

      if (result.success && result.data) {
        const data = result.data;
        const rawStatus = (data.status || 'WAITING').toUpperCase();
        itemCount = data.itemCount || itemCount;
        successCount = data.successfulCount || 0;
        errorCount = data.failedCount || 0;

        // Ürün bazlı hataları topla
        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            if (item.failureReason) {
              itemErrors.push({
                sku: item.stockCode || item.barcode || '',
                barcode: item.barcode || '',
                error: item.failureReason,
              });
            }
          }
        }

        // Status mapping
        if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED') {
          currentStatus = 'SUCCESS';
        } else if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
          currentStatus = 'FAILED';
        } else if (rawStatus === 'PROCESSING') {
          currentStatus = 'PROCESSING';
        } else {
          currentStatus = 'WAITING';
        }

        // Callback ile durum bildir
        if (onStatusChange) {
          onStatusChange(currentStatus, {
            pollCount,
            successCount,
            errorCount,
            itemErrors,
          });
        }

        // Başarı veya hata durumunda döngüyü bitir
        const rawStatusStr: string = currentStatus;
        if (rawStatusStr === 'SUCCESS' || rawStatusStr === 'FAILED') {
          break;
        }

        // Event yayınla
        const isTerminal = rawStatusStr === 'SUCCESS' || rawStatusStr === 'FAILED';
        const eventData: any = {
          type: 'MarketplaceResponse',
          correlationId,
          timestamp: new Date().toISOString(),
          source: 'TrendyolBatchService',
          data: {
            marketplaceKey: 'trendyol',
            operation: 'createProduct',
            success: isTerminal,
            status: result.status,
            duration: Date.now() - startTime,
            retryCount: 0,
            meta: {
              batchRequestId,
              batchStatus: currentStatus,
              pollCount,
              successCount,
              errorCount,
            },
          },
        };
        EventBus.emit(eventData);
      } else {
        // API hatası - tekrar dene
        MarketplaceLogger.logMessage('WARN', `⚠️ Poll attempt ${pollCount} failed for batch ${batchRequestId}: ${result.error?.message} [${correlationId}]`, {
          marketplaceKey: 'trendyol', correlationId, operation: 'createProduct',
        });
      }
    } catch (err: any) {
      MarketplaceLogger.logMessage('ERROR', `❌ Poll error for batch ${batchRequestId}: ${err.message} [${correlationId}]`, {
        marketplaceKey: 'trendyol', correlationId, operation: 'createProduct',
        error: err.message,
      });
      // Network hatası - bekle ve tekrar dene
    }

    // Polling aralığı kadar bekle
    await new Promise(resolve => setTimeout(resolve, config.pollInterval));
  }

  return {
    batchNo: '',
    batchRequestId,
    itemCount,
    status: currentStatus,
    rawStatus: currentStatus,
    pollCount,
    startedAt: startTime,
    finishedAt: Date.now(),
    successCount,
    errorCount,
    itemErrors,
    correlationId,
  };
}

// ==================== BATCH SCHEDULER ====================

/**
 * Batch Scheduler.
 * Ürünleri 50'şerli gruplara böler, sırayla gönderir ve poll eder.
 * Concurrency ayarlanabilir.
 * 
 * Kullanım:
 * ```typescript
 * const scheduler = new TrendyolBatchScheduler(client, authHeaders);
 * const result = await scheduler.execute(products, correlationId);
 * ```
 */
export class TrendyolBatchScheduler {
  private config: BatchSchedulerConfig;
  private client: MarketplaceClient;
  private authHeaders: Record<string, string>;
  private activeBatches = 0;
  private cancelled = false;
  private supplierId: number;
  private baseUrl: string;

  constructor(
    client: MarketplaceClient,
    authHeaders: Record<string, string>,
    options?: Partial<BatchSchedulerConfig> & { supplierId?: number; baseUrl?: string }
  ) {
    this.client = client;
    this.authHeaders = authHeaders;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.supplierId = options?.supplierId || 2738;
    this.baseUrl = options?.baseUrl || 'https://stageapi.trendyol.com';
  }

  /**
   * Tüm ürünleri batch'lere böl, sırayla gönder ve poll et.
   * 
   * @param products - Trendyol formatındaki ürünler
   * @param masterCorrelationId - Ana correlation ID
   * @returns BatchJob - Tüm batch'lerin sonucu
   */
  async execute(
    products: TrendyolProductItem[],
    masterCorrelationId?: CorrelationId
  ): Promise<BatchJob> {
    const cid = masterCorrelationId || createCorrelationId('API');
    this.cancelled = false;

    // Batch'lere böl
    const batches = this.splitIntoBatches(products);
    const totalItems = products.length;

    MarketplaceLogger.logMessage('INFO',
      `📦 Starting batch job: ${totalItems} products in ${batches.length} batch(es) [${cid}]`,
      { marketplaceKey: 'trendyol', correlationId: cid, operation: 'createProduct' }
    );

    // İlk event
    (EventBus.emit as any)({
      type: 'MarketplaceResponse',
      correlationId: cid,
      timestamp: new Date().toISOString(),
      source: 'TrendyolBatchScheduler',
      data: {
        marketplaceKey: 'trendyol',
        operation: 'createProduct',
        success: true,
        status: 202,
        duration: 0,
        retryCount: 0,
        meta: { totalBatches: batches.length, totalItems, status: 'STARTED' },
      },
    });

    const batchInfos: BatchInfo[] = [];

    // Batch'leri sırayla işle (concurrency kontrollü)
    for (let i = 0; i < batches.length; i++) {
      if (this.cancelled) break;

      const batch = batches[i];
      const batchNo = String(i + 1).padStart(2, '0');
      const batchCid = `${cid}-batch-${batchNo}`;

      // Concurrency limiti bekle
      await this.waitForSlot();

      // Batch'i gönder ve poll et
      const batchInfo = await this.processBatch(batch, batchNo, batchCid);
      batchInfos.push(batchInfo);

      this.activeBatches--;
    }

    // Toplam sonuçları hesapla
    const totalSuccess = batchInfos.reduce((sum, b) => sum + b.successCount, 0);
    const totalErrors = batchInfos.reduce((sum, b) => sum + b.errorCount, 0);
    
    let status: BatchJob['status'];
    if (this.cancelled) {
      status = 'CANCELLED';
    } else if (totalErrors === 0 && totalSuccess === totalItems) {
      status = 'SUCCESS';
    } else if (totalSuccess > 0) {
      status = 'PARTIAL';
    } else {
      status = 'FAILED';
    }

    const job: BatchJob = {
      masterCorrelationId: cid,
      batches: batchInfos,
      totalItems,
      totalSuccess,
      totalErrors,
      status,
      createdAt: Date.now(),
    };

    // Sonuç event'i
    (EventBus.emit as any)({
      type: 'MarketplaceResponse',
      correlationId: cid,
      timestamp: new Date().toISOString(),
      source: 'TrendyolBatchScheduler',
      data: {
        marketplaceKey: 'trendyol',
        operation: 'createProduct',
        success: status === 'SUCCESS' || status === 'PARTIAL',
        status: status === 'SUCCESS' ? 200 : status === 'PARTIAL' ? 206 : 500,
        duration: Date.now() - (batchInfos[0]?.startedAt || Date.now()),
        retryCount: 0,
        meta: {
          status,
          totalItems,
          totalSuccess,
          totalErrors,
          batchCount: batches.length,
        },
      },
    });

    MarketplaceLogger.logMessage('INFO',
      `📊 Batch job completed: ${totalSuccess}/${totalItems} successful, ${totalErrors} errors (${status}) [${cid}]`,
      { marketplaceKey: 'trendyol', correlationId: cid, operation: 'createProduct' }
    );

    return job;
  }

  /** İşlemi iptal et */
  cancel(): void {
    this.cancelled = true;
  }

  /** Concurrency limiti için slot bekle */
  private async waitForSlot(): Promise<void> {
    while (this.activeBatches >= this.config.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.activeBatches++;
  }

  /**
   * Tek bir batch'i işle:
   * 1. POST /products (batch gönder)
   * 2. 202 Accepted → batchRequestId al
   * 3. Polling başlat
   */
  private async processBatch(
    products: TrendyolProductItem[],
    batchNo: string,
    correlationId: string
  ): Promise<BatchInfo> {
    const requestBody = TrendyolProductMapper.toProductRequest(products);
    const startTime = Date.now();
    let batchRequestId = '';

    MarketplaceLogger.logMessage('INFO',
      `📦 Sending batch ${batchNo} (${products.length} products) [${correlationId}]`,
      { marketplaceKey: 'trendyol', correlationId, operation: 'createProduct' }
    );

    try {
      // 1. Batch'i gönder (stage/prod path otomatik)
      const batchPath = this.buildApiPath('/products');
      const result = await this.client.post<any>(
        batchPath,
        requestBody,
        {
          operation: 'createProduct',
          correlationId: correlationId as any,
          authHeaders: this.authHeaders,
          priority: 'HIGH',
        }
      );

      if (!result.success) {
        // Batch gönderimi başarısız
        return {
          batchNo,
          batchRequestId: '',
          itemCount: products.length,
          status: 'FAILED',
          rawStatus: 'SEND_FAILED',
          pollCount: 0,
          startedAt: startTime,
          finishedAt: Date.now(),
          successCount: 0,
          errorCount: products.length,
          itemErrors: products.map(p => ({
            sku: p.stockCode,
            barcode: p.barcode,
            error: result.error?.message || 'Batch gönderim hatası',
          })),
          correlationId,
        };
      }

      // 2. batchRequestId'yi al
      batchRequestId = result.data?.batchRequestId || '';
      if (!batchRequestId) {
        return {
          batchNo,
          batchRequestId: '',
          itemCount: products.length,
          status: 'FAILED',
          rawStatus: 'NO_BATCH_ID',
          pollCount: 0,
          startedAt: startTime,
          finishedAt: Date.now(),
          successCount: 0,
          errorCount: products.length,
          itemErrors: products.map(p => ({
            sku: p.stockCode,
            barcode: p.barcode,
            error: 'Yanıtta batchRequestId bulunamadı',
          })),
          correlationId,
        };
      }

      // 3. Polling başlat
      const batchInfo = await pollBatchRequest(
        this.client,
        batchRequestId,
        this.config,
        correlationId as any,
        this.authHeaders,
        (status, info) => {
          MarketplaceLogger.logMessage('INFO',
            `🔄 Batch ${batchNo}: ${status} (poll:${info.pollCount}) [${correlationId}]`,
            { marketplaceKey: 'trendyol', correlationId, operation: 'createProduct' }
          );
        }
      );

      batchInfo.batchNo = batchNo;

      // Partial success log
      if (batchInfo.errorCount > 0 && batchInfo.successCount > 0) {
        MarketplaceLogger.logMessage('WARN',
          `⚠️ Batch ${batchNo}: ${batchInfo.successCount} success, ${batchInfo.errorCount} failed [${correlationId}]`,
          { marketplaceKey: 'trendyol', correlationId, operation: 'createProduct' }
        );
        // Ürün bazlı hataları log'la
        for (const itemErr of batchInfo.itemErrors) {
          MarketplaceLogger.logMessage('ERROR',
            `❌ Product ${itemErr.sku} (${itemErr.barcode}): ${itemErr.error} [${correlationId}]`,
            { marketplaceKey: 'trendyol', correlationId, operation: 'createProduct', error: itemErr.error }
          );
        }
      }

      return batchInfo;

    } catch (err: any) {
      return {
        batchNo,
        batchRequestId,
        itemCount: products.length,
        status: 'FAILED',
        rawStatus: 'EXCEPTION',
        pollCount: 0,
        startedAt: startTime,
        finishedAt: Date.now(),
        successCount: 0,
        errorCount: products.length,
        itemErrors: products.map(p => ({
          sku: p.stockCode,
          barcode: p.barcode,
          error: err.message,
        })),
        correlationId,
      };
    }
  }

  /** Ürünleri batch'lere böl (her batch max 50 ürün) */
  private splitIntoBatches(products: TrendyolProductItem[]): TrendyolProductItem[][] {
    const batches: TrendyolProductItem[][] = [];
    for (let i = 0; i < products.length; i += this.config.batchSize) {
      batches.push(products.slice(i, i + this.config.batchSize));
    }
    return batches;
  }

  /** Stage/Production bazlı API path oluştur */
  private buildApiPath(path: string): string {
    const isStage = this.baseUrl.includes('stageapi') || this.baseUrl.includes('stage');
    const prodPrefix = '/sapigw';
    const prefix = isStage ? '/stagesapigw' : prodPrefix;
    return `${prefix}/suppliers/${this.supplierId}${path}`;
  }

  /** Supplier ID */
  private getSupplierId(): string {
    return String(this.supplierId);
  }
}
