// ==================== TRENDYOL IDEMPOTENCY V1.0 ====================
// Idempotency-Key + ProductHash ile tekrar gönderim koruması.
// 
// Aynı ürün ağ hatası nedeniyle ikinci kez gönderilmemeli.
// Her ürünün hash'i (barcode + price + stock) saklanır.
// ===================================================================

import { createHash } from 'crypto';
import { CorrelationId } from '../../eventBus/events.ts';
import { MarketplaceLogger } from '../core/MarketplaceLogger.ts';

/** Idempotency kaydı */
interface IdempotencyRecord {
  key: string;
  productHash: string;
  batchRequestId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  createdAt: number;
  expiresAt: number;
}

/**
 * Idempotency Yöneticisi.
 * 
 * Kullanım:
 * ```typescript
 * const hash = TrendyolIdempotency.hashProduct(barcode, price, stock);
 * if (await TrendyolIdempotency.isDuplicate(hash)) {
 *   // Bu ürün zaten gönderildi, atla
 * }
 * const key = TrendyolIdempotency.generateKey();
 * ```
 */
export class TrendyolIdempotency {
  private static records = new Map<string, IdempotencyRecord>();
  private static readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

  /**
   * Ürün için unique hash oluştur.
   * Aynı barcode + price + stock = aynı hash.
   */
  static hashProduct(barcode: string, price: number, stock: number): string {
    const input = `${barcode}:${price}:${stock}`;
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Idempotency-Key oluştur (X-Request-Id olarak kullanılır)
   */
  static generateKey(): string {
    return `idem-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Ürün daha önce gönderilmiş mi kontrol et.
   * Hash bazlı çalışır.
   */
  static async isDuplicate(productHash: string): Promise<boolean> {
    const record = this.records.get(productHash);
    if (!record) return false;

    // TTL kontrolü
    if (Date.now() > record.expiresAt) {
      this.records.delete(productHash);
      return false;
    }

    // SUCCESS veya PROCESSING ise duplicate
    if (record.status === 'SUCCESS' || record.status === 'PROCESSING') {
      MarketplaceLogger.logMessage('WARN', `⏭️ Duplicate product detected: hash=${productHash}, previous=${record.batchRequestId}`, {
        marketplaceKey: 'trendyol',
        correlationId: 'N/A',
        operation: 'createProduct',
      });
      return true;
    }

    return false;
  }

  /**
   * Ürün gönderimini kaydet.
   */
  static async markSent(productHash: string, idempotencyKey: string, batchRequestId: string): Promise<void> {
    this.records.set(productHash, {
      key: idempotencyKey,
      productHash,
      batchRequestId,
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  /**
   * İşlem durumunu güncelle.
   */
  static async updateStatus(productHash: string, status: IdempotencyRecord['status']): Promise<void> {
    const record = this.records.get(productHash);
    if (record) {
      record.status = status;
    }
  }

  /**
   * Eski kayıtları temizle.
   */
  static cleanExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.records) {
      if (now > record.expiresAt) {
        this.records.delete(key);
      }
    }
  }

  /** Test için */
  static clear(): void {
    this.records.clear();
  }
}
