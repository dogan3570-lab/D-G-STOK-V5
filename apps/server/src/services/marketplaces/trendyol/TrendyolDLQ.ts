// ==================== TRENDYOL DEAD LETTER QUEUE V1.0 ====================
// 3-5 retry sonunda başarısız olan ürünler buraya düşer.
// Operatör inceleyip tekrar gönderebilir.
// ========================================================================

import { CorrelationId } from '../../eventBus/events.ts';
import { MarketplaceLogger } from '../core/MarketplaceLogger.ts';

interface DLQEntry {
  id: string;
  sku: string;
  barcode: string;
  title: string;
  error: string;
  batchRequestId: string;
  batchNo: string;
  masterCorrelationId: CorrelationId;
  failedAt: number;
  retryCount: number;
  productData: any;
  status: 'WAITING' | 'RETRYING' | 'RESOLVED' | 'IGNORED';
}

/**
 * Dead Letter Queue.
 * Başarısız ürünleri saklar, operatörün tekrar göndermesini sağlar.
 */
export class TrendyolDLQ {
  private static entries: DLQEntry[] = [];
  private static maxEntries = 10000;

  /**
   * Başarısız ürünü DLQ'ya ekle.
   */
  static async add(entry: Omit<DLQEntry, 'id' | 'failedAt' | 'status'>): Promise<void> {
    const dlqEntry: DLQEntry = {
      ...entry,
      id: `dlq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      failedAt: Date.now(),
      status: 'WAITING',
    };

    this.entries.push(dlqEntry);

    // Max limit
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    MarketplaceLogger.logMessage('ERROR',
      `📋 DLQ: ${entry.sku} (${entry.barcode}) added: ${entry.error} [${entry.masterCorrelationId}]`,
      {
        marketplaceKey: 'trendyol',
        correlationId: entry.masterCorrelationId,
        operation: 'createProduct',
        error: entry.error,
        metadata: { sku: entry.sku, barcode: entry.barcode },
      }
    );
  }

  /**
   * DLQ'daki tüm kayıtları getir.
   */
  static async getAll(status?: DLQEntry['status']): Promise<DLQEntry[]> {
    if (status) {
      return this.entries.filter(e => e.status === status);
    }
    return [...this.entries];
  }

  /**
   * Tekrar gönderilmek üzere işaretle.
   */
  static async markRetrying(id: string): Promise<void> {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.status = 'RETRYING';
    }
  }

  /**
   * Başarıyla gönderildi olarak işaretle.
   */
  static async markResolved(id: string): Promise<void> {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.status = 'RESOLVED';
    }
  }

  /**
   * İgnore olarak işaretle (operatör kararı).
   */
  static async markIgnored(id: string): Promise<void> {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.status = 'IGNORED';
    }
  }

  /**
   * DLQ istatistikleri.
   */
  static getStats(): { total: number; waiting: number; resolved: number; ignored: number } {
    return {
      total: this.entries.length,
      waiting: this.entries.filter(e => e.status === 'WAITING').length,
      resolved: this.entries.filter(e => e.status === 'RESOLVED').length,
      ignored: this.entries.filter(e => e.status === 'IGNORED').length,
    };
  }

  /** Test için */
  static clear(): void {
    this.entries = [];
  }
}
