// ==================== TRENDYOL METRICS V1.0 ====================
// Batch job metrikleri: Başarı%, ortalama süre, en uzun batch,
// en çok retry, en çok hata alan SKU/API, dakikadaki gönderim
// ===============================================================

import { EventBus } from '../../eventBus/EventBus.ts';
import { createCorrelationId } from '../../eventBus/events.ts';
import { BatchInfo, BatchJob } from './TrendyolBatchService.ts';

interface MetricsSnapshot {
  timestamp: number;
  /** Son 5 dk başarı yüzdesi */
  successRate: number;
  /** Ortalama batch süresi (ms) */
  averageBatchDuration: number;
  /** En uzun batch süresi (ms) */
  longestBatchDuration: number;
  /** En çok retry yapılan API */
  mostRetriedApi: string;
  /** En çok hata alan SKU */
  mostFailedSku: string;
  /** En çok hata alan API endpoint */
  mostFailedEndpoint: string;
  /** Dakikadaki ortalama gönderim */
  throughputPerMinute: number;
  /** Toplam gönderim */
  totalSent: number;
  /** Toplam hata */
  totalErrors: number;
  /** Toplam retry */
  totalRetries: number;
}

/** API çağrı kaydı */
interface ApiCallRecord {
  endpoint: string;
  duration: number;
  success: boolean;
  retryCount: number;
  sku?: string;
  timestamp: number;
}

/**
 * Metrics toplayıcı.
 * Her batch job sonunda metrikleri hesaplar ve EventBus'a yayınlar.
 */
export class TrendyolMetrics {
  private static apiCalls: ApiCallRecord[] = [];
  private static batchJobs: BatchJob[] = [];
  private static readonly MAX_HISTORY = 1000;

  /**
   * API çağrısını kaydet.
   */
  static recordApiCall(record: ApiCallRecord): void {
    this.apiCalls.push(record);
    if (this.apiCalls.length > this.MAX_HISTORY) {
      this.apiCalls.shift();
    }
  }

  /**
   * Batch job sonucunu kaydet.
   */
  static recordBatchJob(job: BatchJob): void {
    this.batchJobs.push(job);
    if (this.batchJobs.length > this.MAX_HISTORY) {
      this.batchJobs.shift();
    }

    // Metrics snapshot'i hesapla ve event yayınla
    const snapshot = this.calculateSnapshot();
    
    (EventBus.emit as any)({
      type: 'MarketplaceResponse',
      correlationId: job.masterCorrelationId,
      timestamp: new Date().toISOString(),
      source: 'TrendyolMetrics',
      data: {
        marketplaceKey: 'trendyol',
        operation: 'metrics',
        success: true,
        status: 200,
        duration: 0,
        retryCount: 0,
        meta: { metrics: snapshot },
      },
    });
  }

  /**
   * Anlık metrik hesapla.
   */
  static calculateSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const last5Min = now - 5 * 60 * 1000;
    const lastHour = now - 60 * 60 * 1000;

    // Son 5 dk
    const recentCalls = this.apiCalls.filter(c => c.timestamp > last5Min);
    const recentSuccess = recentCalls.filter(c => c.success).length;
    const successRate = recentCalls.length > 0
      ? Math.round((recentSuccess / recentCalls.length) * 1000) / 10
      : 100;

    // Batch süreleri
    const recentBatches = this.batchJobs.filter(j => j.createdAt > lastHour);
    const durations = recentBatches
      .flatMap(j => j.batches)
      .filter(b => b.finishedAt)
      .map(b => (b.finishedAt! - b.startedAt));

    const averageBatchDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const longestBatchDuration = durations.length > 0
      ? Math.max(...durations)
      : 0;

    // En çok retry alan API
    const retryByEndpoint = new Map<string, number>();
    this.apiCalls.forEach(c => {
      retryByEndpoint.set(c.endpoint, (retryByEndpoint.get(c.endpoint) || 0) + c.retryCount);
    });
    const mostRetriedApi = [...retryByEndpoint.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // En çok hata alan SKU
    const errorsBySku = new Map<string, number>();
    this.apiCalls.filter(c => !c.success && c.sku).forEach(c => {
      errorsBySku.set(c.sku!, (errorsBySku.get(c.sku!) || 0) + 1);
    });
    const mostFailedSku = [...errorsBySku.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // En çok hata alan endpoint
    const errorsByEndpoint = new Map<string, number>();
    this.apiCalls.filter(c => !c.success).forEach(c => {
      errorsByEndpoint.set(c.endpoint, (errorsByEndpoint.get(c.endpoint) || 0) + 1);
    });
    const mostFailedEndpoint = [...errorsByEndpoint.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Throughput
    const lastMinCalls = this.apiCalls.filter(c => c.timestamp > now - 60000).length;
    const throughputPerMinute = lastMinCalls;

    const totalSent = this.apiCalls.length;
    const totalErrors = this.apiCalls.filter(c => !c.success).length;
    const totalRetries = this.apiCalls.reduce((sum, c) => sum + c.retryCount, 0);

    return {
      timestamp: now,
      successRate,
      averageBatchDuration,
      longestBatchDuration,
      mostRetriedApi,
      mostFailedSku,
      mostFailedEndpoint,
      throughputPerMinute,
      totalSent,
      totalErrors,
      totalRetries,
    };
  }

  /**
   * Son metrikleri getir.
   */
  static getLatest(): MetricsSnapshot | null {
    if (this.batchJobs.length === 0) return null;
    return this.calculateSnapshot();
  }

  /** Test için */
  static clear(): void {
    this.apiCalls = [];
    this.batchJobs = [];
  }
}
