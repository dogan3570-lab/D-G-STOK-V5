// ==================== MARKETPLACE SDK - EVENT TİPLERİ V1.0 ====================
// EventBus ile uyumlu marketplace event'leri.
// Tüm pazaryeri adapter'ları bu event'leri yayınlar.
// =============================================================================

import { CorrelationId } from '../../eventBus/events.ts';
import { MarketplaceKey, OperationType, ConnectionStatus } from './MarketplaceTypes.ts';

/** Marketplace API çağrısı başladığında */
export interface MarketplaceRequestEvent {
  type: 'MarketplaceRequest';
  correlationId: CorrelationId;
  timestamp: string;
  source: string;
  data: {
    marketplaceKey: MarketplaceKey;
    operation: OperationType;
    endpoint: string;
    method: string;
    requestBody?: any;
  };
}

/** Marketplace API çağrısı tamamlandığında */
export interface MarketplaceResponseEvent {
  type: 'MarketplaceResponse';
  correlationId: CorrelationId;
  timestamp: string;
  source: string;
  data: {
    marketplaceKey: MarketplaceKey;
    operation: OperationType;
    success: boolean;
    status: number;
    duration: number;
    error?: string;
    retryCount: number;
  };
}

/** Pazaryeri bağlantı durumu değiştiğinde */
export interface MarketplaceConnectionEvent {
  type: 'MarketplaceConnectionChanged';
  correlationId: CorrelationId;
  timestamp: string;
  source: string;
  data: {
    marketplaceKey: MarketplaceKey;
    status: ConnectionStatus;
    previousStatus: ConnectionStatus;
    error?: string;
  };
}

/** Rate limit aşıldığında */
export interface MarketplaceRateLimitEvent {
  type: 'MarketplaceRateLimit';
  correlationId: CorrelationId;
  timestamp: string;
  source: string;
  data: {
    marketplaceKey: MarketplaceKey;
    retryAfter: number;
    currentQueueSize: number;
  };
}

/** Sağlık kontrolü sonucu */
export interface MarketplaceHealthEvent {
  type: 'MarketplaceHealth';
  correlationId: CorrelationId;
  timestamp: string;
  source: string;
  data: {
    marketplaceKey: MarketplaceKey;
    healthy: boolean;
    latency: number;
    error?: string;
  };
}

/** Kimlik doğrulama durumu */
export interface MarketplaceAuthEvent {
  type: 'MarketplaceAuth';
  correlationId: CorrelationId;
  timestamp: string;
  source: string;
  data: {
    marketplaceKey: MarketplaceKey;
    authenticated: boolean;
    expiresAt?: string;
    error?: string;
  };
}

/** Birleşik event tipi */
export type MarketplaceCoreEvent =
  | MarketplaceRequestEvent
  | MarketplaceResponseEvent
  | MarketplaceConnectionEvent
  | MarketplaceRateLimitEvent
  | MarketplaceHealthEvent
  | MarketplaceAuthEvent;
