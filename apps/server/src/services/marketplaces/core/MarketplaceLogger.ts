// ==================== MARKETPLACE SDK - LOGGER V1.0 ====================
// Correlation ID, Request/Response, Duration, Retry Count, Marketplace,
// Endpoint, Status bilgilerini log'lar.
// =======================================================================

import { CorrelationId } from '../../eventBus/events.ts';
import { MarketplaceKey, HttpMethod, OperationType } from './MarketplaceTypes.ts';

/** Log seviyesi */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/** Log kaydı */
export interface MarketplaceLogEntry {
  timestamp: string;
  level: LogLevel;
  marketplaceKey: MarketplaceKey;
  correlationId: CorrelationId;
  operation?: OperationType;
  method?: HttpMethod;
  endpoint?: string;
  status?: number;
  /** Toplam işlem süresi (API + queue + retry) */
  duration?: number;
  /** API çağrı süresi (net HTTP) */
  apiDuration?: number;
  /** Kuyrukta bekleme süresi */
  queueWaitingTime?: number;
  /** Retry harcanan toplam süre */
  retryDuration?: number;
  retryCount?: number;
  /** İstek boyutu (bytes) */
  requestSize?: number;
  /** Yanıt boyutu (bytes) */
  responseSize?: number;
  /** Sıkıştırılmış yanıt boyutu (bytes) */
  compressedResponseSize?: number;
  /** Bellek kullanımı (MB) */
  memoryUsage?: number;
  message: string;
  error?: string;
  metadata?: Record<string, any>;
}

/** Log handler fonksiyonu */
export type LogHandler = (entry: MarketplaceLogEntry) => void;

/**
 * Marketplace Logger.
 * Tüm API isteklerini yapılandırılmış formatta log'lar.
 */
export class MarketplaceLogger {
  private static handlers: LogHandler[] = [];
  private static history: MarketplaceLogEntry[] = [];
  private static maxHistory = 1000;
  private static minLevel: LogLevel = 'DEBUG';

  /**
   * Log handler ekle (örn: dosyaya yazma, DB'ye kaydetme)
   */
  static addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Minimum log seviyesini ayarla
   */
  static setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * API isteğini log'la
   */
  static logRequest(options: {
    marketplaceKey: MarketplaceKey;
    correlationId: CorrelationId;
    operation: OperationType;
    method: HttpMethod;
    endpoint: string;
    requestBody?: any;
  }): void {
    const entry: MarketplaceLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      marketplaceKey: options.marketplaceKey,
      correlationId: options.correlationId,
      operation: options.operation,
      method: options.method,
      endpoint: options.endpoint,
      message: `➡️ ${options.method} ${options.endpoint}`,
      metadata: options.requestBody ? { body: this.sanitize(options.requestBody) } : undefined,
    };
    this.log(entry);
  }

  /**
   * API yanıtını log'la
   */
  static logResponse(options: {
    marketplaceKey: MarketplaceKey;
    correlationId: CorrelationId;
    operation: OperationType;
    method: HttpMethod;
    endpoint: string;
    status: number;
    duration: number;
    apiDuration?: number;
    queueWaitingTime?: number;
    retryDuration?: number;
    retryCount: number;
    requestSize?: number;
    responseSize?: number;
    error?: string;
  }): void {
    const isError = options.status >= 400 || !!options.error;
    const entry: MarketplaceLogEntry = {
      timestamp: new Date().toISOString(),
      level: isError ? (options.status >= 500 ? 'ERROR' : 'WARN') : 'INFO',
      marketplaceKey: options.marketplaceKey,
      correlationId: options.correlationId,
      operation: options.operation,
      method: options.method,
      endpoint: options.endpoint,
      status: options.status,
      duration: options.duration,
      apiDuration: options.apiDuration,
      queueWaitingTime: options.queueWaitingTime,
      retryDuration: options.retryDuration,
      retryCount: options.retryCount,
      requestSize: options.requestSize,
      responseSize: options.responseSize,
      memoryUsage: Math.round(process.memoryUsage?.()?.heapUsed / 1024 / 1024 * 100) / 100,
      message: isError
        ? `❌ ${options.status} ${options.endpoint} (${options.duration}ms) [retry:${options.retryCount}]`
        : `✅ ${options.status} ${options.endpoint} (${options.duration}ms)`,
      error: options.error,
    };
    this.log(entry);
  }

  /**
   * Özel log mesajı
   */
  static logMessage(level: LogLevel, message: string, options?: {
    marketplaceKey?: MarketplaceKey;
    correlationId?: CorrelationId;
    operation?: OperationType;
    error?: string;
    metadata?: Record<string, any>;
  }): void {
    const entry: MarketplaceLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      marketplaceKey: options?.marketplaceKey || 'trendyol' as MarketplaceKey,
      correlationId: options?.correlationId || 'N/A',
      operation: options?.operation,
      message,
      error: options?.error,
      metadata: options?.metadata,
    };
    this.log(entry);
  }

  /**
   * Son log kayıtlarını getir
   */
  static getHistory(limit = 50, level?: LogLevel): MarketplaceLogEntry[] {
    let entries = this.history;
    if (level) {
      entries = entries.filter(e => e.level === level);
    }
    return entries.slice(-limit);
  }

  /**
   * Belirli bir correlation ID'ye ait tüm logları getir
   */
  static getByCorrelationId(correlationId: CorrelationId): MarketplaceLogEntry[] {
    return this.history.filter(e => e.correlationId === correlationId);
  }

  private static log(entry: MarketplaceLogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Konsola yaz
    const prefix = `[${entry.level}] [${entry.marketplaceKey}] [${entry.correlationId}]`;
    if (entry.level === 'ERROR') {
      console.error(`${prefix} ${entry.message}`, entry.error || '');
    } else if (entry.level === 'WARN') {
      console.warn(`${prefix} ${entry.message}`);
    } else {
      console.log(`${prefix} ${entry.message}`);
    }

    // History'e ekle
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Handler'ları çağır
    for (const handler of this.handlers) {
      try { handler(entry); } catch { /* ignore */ }
    }
  }

  private static shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  /** Hassas verileri temizle */
  private static sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = { ...obj };
    const sensitiveKeys = ['password', 'apiKey', 'apiSecret', 'token', 'secret', 'authorization'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) sanitized[key] = '***';
    }
    return sanitized;
  }
}
