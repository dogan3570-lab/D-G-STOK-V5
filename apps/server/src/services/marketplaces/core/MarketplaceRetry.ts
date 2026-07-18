// ==================== MARKETPLACE SDK - RETRY POLİTİKASI V1.0 ====================
// Exponential backoff, jitter, HTTP status bazlı retry kararları.
// ===============================================================================

import { CorrelationId } from '../../eventBus/events.ts';

/** Retry yapılandırması */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;        // ms
  maxDelay: number;         // ms (cap)
  useJitter: boolean;       // Rastgele gecikme ekle
  retryOnStatus: number[];  // Hangi HTTP status'lerde retry yapılacak
  retryOnError: boolean;    // Network hatasında retry
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  useJitter: true,
  retryOnStatus: [429, 500, 502, 503, 504],
  retryOnError: true,
};

/** Retry kararı */
export interface RetryDecision {
  shouldRetry: boolean;
  delay: number;
  reason: string;
}

/**
 * Retry politikası yöneticisi.
 * Exponential backoff + jitter ile akıllı retry.
 */
export class MarketplaceRetry {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Bir sonraki deneme için karar ver.
   * 
   * @param attempt - Kaçıncı deneme (0-indexed)
   * @param httpStatus - HTTP status code (varsa)
   * @param error - Hata nesnesi (varsa)
   * @returns Retry kararı
   */
  decide(attempt: number, httpStatus?: number, error?: any): RetryDecision {
    // Max retry aşıldı mı?
    if (attempt >= this.config.maxRetries) {
      return { shouldRetry: false, delay: 0, reason: `Max retries (${this.config.maxRetries}) reached` };
    }

    // Network hatası
    if (!httpStatus && error && this.config.retryOnError) {
      return {
        shouldRetry: true,
        delay: this.calculateDelay(attempt),
        reason: `Network error: ${error.message || 'Unknown'}`,
      };
    }

    // HTTP status kontrolü
    if (httpStatus && this.config.retryOnStatus.includes(httpStatus)) {
      let delay = this.calculateDelay(attempt);

      // 429: Retry-After header'ına saygı göster
      if (httpStatus === 429 && error?.response?.headers?.['retry-after']) {
        delay = parseInt(error.response.headers['retry-after']) * 1000;
      }

      return {
        shouldRetry: true,
        delay,
        reason: `HTTP ${httpStatus} - retrying`,
      };
    }

    // 4xx (non-429): Retry yapma
    if (httpStatus && httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) {
      return { shouldRetry: false, delay: 0, reason: `HTTP ${httpStatus} - not retryable` };
    }

    return { shouldRetry: false, delay: 0, reason: 'No retry needed' };
  }

  /**
   * Exponential backoff ile gecikme hesapla.
   * Formula: min(baseDelay * 2^attempt, maxDelay)
   * Jitter: ±%25 rastgele sapma
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    if (!this.config.useJitter) {
      return cappedDelay;
    }

    // ±%25 jitter
    const jitter = cappedDelay * 0.25;
    const jitteredDelay = cappedDelay + (Math.random() * jitter * 2 - jitter);
    return Math.round(Math.max(0, jitteredDelay));
  }

  /**
   * Belirli bir HTTP status kodunun retry edilebilir olup olmadığını kontrol et.
   */
  static isRetryable(status: number): boolean {
    return status === 429 || status >= 500 || status === 0;
  }

  /**
   * Retry gecikmesini hesapla (statik).
   */
  static calculateBackoff(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  }
}
