// ==================== MARKETPLACE SDK - HATA MODELİ V1.0 ====================
// Standart hata modeli - tüm pazaryerleri aynı hata yapısını kullanır.
// ============================================================================

import { CorrelationId } from '../../eventBus/events.ts';

/** Hata kategorileri */
export type ErrorCategory =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'UNKNOWN';

/** Hata şiddeti */
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Standart Marketplace hatası.
 * Tüm pazaryeri adapter'ları bu sınıfı kullanır.
 */
export class MarketplaceError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly httpStatus: number;
  public readonly correlationId: CorrelationId;
  public readonly recoverable: boolean;
  public readonly details?: any;
  public readonly retryAfter?: number;
  public readonly timestamp: string;

  constructor(options: {
    category: ErrorCategory;
    message: string;
    httpStatus?: number;
    severity?: ErrorSeverity;
    correlationId: CorrelationId;
    details?: any;
    recoverable?: boolean;
    retryAfter?: number;
  }) {
    super(options.message);
    this.name = 'MarketplaceError';
    this.category = options.category;
    this.httpStatus = options.httpStatus || 500;
    this.severity = options.severity || 'MEDIUM';
    this.correlationId = options.correlationId;
    this.recoverable = options.recoverable ?? false;
    this.details = options.details;
    this.retryAfter = options.retryAfter;
    this.timestamp = new Date().toISOString();
  }

  /** HTTP status code'a göre hata kategorisi belirler */
  static fromHttpStatus(status: number, correlationId: CorrelationId, message?: string): MarketplaceError {
    const category = this.categorize(status);
    return new MarketplaceError({
      category,
      message: message || `HTTP ${status}`,
      httpStatus: status,
      correlationId,
      recoverable: this.isRecoverable(status),
      retryAfter: status === 429 ? 5 : undefined,
    });
  }

  /** HTTP status kodunu hata kategorisine çevirir */
  private static categorize(status: number): ErrorCategory {
    if (status === 401 || status === 403) return 'AUTH_ERROR';
    if (status === 429) return 'RATE_LIMIT';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 400) return 'BAD_REQUEST';
    if (status >= 500) return 'SERVER_ERROR';
    return 'UNKNOWN';
  }

  /** Hata kurtarılabilir mi? */
  private static isRecoverable(status: number): boolean {
    return status === 429 || status >= 500 || status === 0;
  }

  /** Hata kategorisine göre severity belirler */
  getSeverity(): ErrorSeverity {
    switch (this.category) {
      case 'AUTH_ERROR': return 'CRITICAL';
      case 'RATE_LIMIT': return 'LOW';
      case 'NETWORK_ERROR': return 'HIGH';
      case 'TIMEOUT': return 'MEDIUM';
      case 'SERVER_ERROR': return 'HIGH';
      case 'VALIDATION_ERROR': return 'LOW';
      default: return 'MEDIUM';
    }
  }

  /** Log için kısa özet */
  toLogString(): string {
    return `[${this.category}] ${this.message} (HTTP ${this.httpStatus}) [${this.correlationId}]`;
  }
}
