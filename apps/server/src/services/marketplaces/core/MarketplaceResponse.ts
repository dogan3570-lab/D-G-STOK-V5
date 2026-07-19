// ==================== MARKETPLACE SDK - ORTAK RESPONSE MODELİ V1.0 ====================
// Tüm pazaryeri API yanıtları bu modele dönüştürülür.
// =====================================================================================

import { CorrelationId } from '../../eventBus/events.ts';

/**
 * Ortak API yanıt modeli.
 * Her pazaryerinin ham yanıtı bu modele normalize edilir.
 */
export interface MarketplaceResponse<T = any> {
  /** İşlem başarılı mı? */
  success: boolean;
  /** HTTP status code */
  status: number;
  /** Başarılı yanıt verisi */
  data?: T;
  /** Hata detayı (başarısızsa) */
  error?: MarketplaceErrorInfo;
  /** İşlem süresi (ms) */
  duration: number;
  /** Correlation ID */
  correlationId: CorrelationId;
  /** Kaçıncı denemede başarılı oldu? */
  retryCount: number;
  /** Varsa ham API yanıtı (debug için) */
  raw?: any;
}

/** N11Adapter uyumluluğu için success alias */
export function isOk(response: MarketplaceResponse): boolean {
  return response.success;
}

/** Hata bilgisi */
export interface MarketplaceErrorInfo {
  code: string;
  message: string;
  details?: any;
  httpStatus?: number;
  recoverable: boolean;
}

/** Sayfalama bilgisi */
export interface MarketplacePagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Sayfalı yanıt */
export interface MarketplacePaginatedResponse<T> extends MarketplaceResponse<T[]> {
  pagination: MarketplacePagination;
}

/**
 * Başarılı yanıt oluşturucu
 */
export function createSuccessResponse<T>(
  data: T,
  options: {
    status?: number;
    duration: number;
    correlationId: CorrelationId;
    retryCount?: number;
    raw?: any;
  }
): MarketplaceResponse<T> {
  return {
    success: true,
    status: options.status || 200,
    data,
    duration: options.duration,
    correlationId: options.correlationId,
    retryCount: options.retryCount || 0,
    raw: options.raw,
  };
}

/**
 * Hata yanıtı oluşturucu
 */
export function createErrorResponse(
  options: {
    code: string;
    message: string;
    httpStatus?: number;
    details?: any;
    duration: number;
    correlationId: CorrelationId;
    retryCount?: number;
    recoverable?: boolean;
    raw?: any;
  }
): MarketplaceResponse<never> {
  return {
    success: false,
    status: options.httpStatus || 500,
    error: {
      code: options.code,
      message: options.message,
      details: options.details,
      httpStatus: options.httpStatus,
      recoverable: options.recoverable ?? false,
    },
    duration: options.duration,
    correlationId: options.correlationId,
    retryCount: options.retryCount || 0,
    raw: options.raw,
  };
}
