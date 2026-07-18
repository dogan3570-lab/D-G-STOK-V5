// ==================== TRENDYOL CIRCUIT BREAKER V1.0 ====================
// API ardı ardına hata döndürdüğünde istekleri keser.
// State machine: CLOSED → OPEN → HALF_OPEN → CLOSED
// =======================================================================

import { MarketplaceLogger } from '../core/MarketplaceLogger.ts';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitEntry {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  openSince: number;
  halfOpenAttempts: number;
}

/**
 * Circuit Breaker.
 * 
 * Kullanım:
 * ```typescript
 * const cb = TrendyolCircuitBreaker.getInstance('trendyol');
 * if (cb.isOpen()) {
 *   // İstek yapma, hata döndür
 * }
 * await cb.call(async () => {
 *   // API isteği
 * });
 * ```
 */
export class TrendyolCircuitBreaker {
  private static instances = new Map<string, TrendyolCircuitBreaker>();
  
  private circuits = new Map<string, CircuitEntry>();
  private readonly threshold: number;       // OPEN'a geçmek için gereken hata sayısı
  private readonly timeout: number;          // OPEN → HALF_OPEN için bekleme (ms)
  private readonly halfOpenMax: number;      // HALF_OPEN'da maksimum deneme
  private readonly successThreshold: number; // CLOSED'a dönmek için gereken başarı sayısı

  private constructor(options?: {
    threshold?: number;
    timeout?: number;
    halfOpenMax?: number;
    successThreshold?: number;
  }) {
    this.threshold = options?.threshold ?? 5;
    this.timeout = options?.timeout ?? 30000;
    this.halfOpenMax = options?.halfOpenMax ?? 3;
    this.successThreshold = options?.successThreshold ?? 2;
  }

  static getInstance(key: string, options?: {
    threshold?: number;
    timeout?: number;
    halfOpenMax?: number;
    successThreshold?: number;
  }): TrendyolCircuitBreaker {
    if (!TrendyolCircuitBreaker.instances.has(key)) {
      TrendyolCircuitBreaker.instances.set(key, new TrendyolCircuitBreaker(options));
    }
    return TrendyolCircuitBreaker.instances.get(key)!;
  }

  private getOrCreate(key: string): CircuitEntry {
    let entry = this.circuits.get(key);
    if (!entry) {
      entry = {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastFailureAt: 0,
        lastSuccessAt: 0,
        openSince: 0,
        halfOpenAttempts: 0,
      };
      this.circuits.set(key, entry);
    }
    return entry;
  }

  /**
   * Circuit breaker durumunu kontrol et.
   * OPEN ise istek yapılmamalı.
   */
  isOpen(key: string): boolean {
    const entry = this.getOrCreate(key);
    
    if (entry.state === 'CLOSED') return false;
    if (entry.state === 'OPEN') {
      // Timeout geçti mi? HALF_OPEN'a geç
      if (Date.now() - entry.openSince >= this.timeout) {
        entry.state = 'HALF_OPEN';
        entry.halfOpenAttempts = 0;
        MarketplaceLogger.logMessage('INFO', `🔄 Circuit ${key}: OPEN → HALF_OPEN`, {
          marketplaceKey: key as any, correlationId: 'N/A',
        });
        return false;
      }
      return true;
    }
    // HALF_OPEN
    if (entry.halfOpenAttempts >= this.halfOpenMax) {
      entry.state = 'OPEN';
      entry.openSince = Date.now();
      MarketplaceLogger.logMessage('ERROR', `🔴 Circuit ${key}: HALF_OPEN → OPEN (max attempts)`, {
        marketplaceKey: key as any, correlationId: 'N/A',
      });
      return true;
    }
    return false;
  }

  /**
   * Başarılı istek.
   */
  onSuccess(key: string): void {
    const entry = this.getOrCreate(key);
    entry.successCount++;
    entry.lastSuccessAt = Date.now();
    entry.failureCount = 0;

    if (entry.state === 'HALF_OPEN') {
      entry.halfOpenAttempts++;
      if (entry.successCount >= this.successThreshold) {
        entry.state = 'CLOSED';
        entry.successCount = 0;
        MarketplaceLogger.logMessage('INFO', `🟢 Circuit ${key}: HALF_OPEN → CLOSED`, {
          marketplaceKey: key as any, correlationId: 'N/A',
        });
      }
    }
  }

  /**
   * Başarısız istek.
   */
  onFailure(key: string): void {
    const entry = this.getOrCreate(key);
    entry.failureCount++;
    entry.lastFailureAt = Date.now();

    if (entry.state === 'CLOSED' && entry.failureCount >= this.threshold) {
      entry.state = 'OPEN';
      entry.openSince = Date.now();
      MarketplaceLogger.logMessage('ERROR', `🔴 Circuit ${key}: CLOSED → OPEN (${entry.failureCount} failures)`, {
        marketplaceKey: key as any, correlationId: 'N/A',
      });
    }

    if (entry.state === 'HALF_OPEN') {
      entry.state = 'OPEN';
      entry.openSince = Date.now();
      MarketplaceLogger.logMessage('ERROR', `🔴 Circuit ${key}: HALF_OPEN → OPEN (failure in test)`, {
        marketplaceKey: key as any, correlationId: 'N/A',
      });
    }
  }

  /**
   * Circuit breaker ile korumalı API çağrısı.
   */
  async call<T>(key: string, fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.isOpen(key)) {
      MarketplaceLogger.logMessage('WARN', `⚠️ Circuit ${key} is OPEN, using fallback or throwing`, {
        marketplaceKey: key as any, correlationId: 'N/A',
      });
      if (fallback) return fallback();
      throw new Error(`Circuit ${key} is OPEN`);
    }

    try {
      const result = await fn();
      this.onSuccess(key);
      return result;
    } catch (err: any) {
      this.onFailure(key);
      throw err;
    }
  }

  /**
   * Tüm circuit'leri sıfırla.
   */
  static resetAll(): void {
    TrendyolCircuitBreaker.instances.clear();
  }

  /** Durum bilgisi */
  getState(key: string): { state: CircuitState; failureCount: number } {
    const entry = this.getOrCreate(key);
    return { state: entry.state, failureCount: entry.failureCount };
  }
}
