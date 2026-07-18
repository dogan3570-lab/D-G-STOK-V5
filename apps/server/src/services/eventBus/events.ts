// ==================== DG STOK EVENT TANIMLARI V2.0 ====================
// Tüm modüller arası iletişim bu event'ler üzerinden sağlanır.
// Modüller birbirini DOĞRUDAN çağırmaz, event yayınlar.
// Workflow Cascade: Kategori → Marka → Varyant → Şablon → ReadyToSend
// ======================================================================

// ==================== TEMEL TİPLER ====================

/**
 * Correlation ID - Her işlemin benzersiz kimliği
 * Format: ÖN-20260715-000001
 * Ön ekler: SP (StockProtection), XML (XmlImport), MP (Marketplace), WF (Workflow)
 * Tüm loglar aynı ID altında toplanır
 */
export type CorrelationId = string;

/**
 * Correlation ID oluşturucu
 */
let counter = 0;
export function createCorrelationId(prefix: 'SP' | 'XML' | 'MP' | 'API' | 'BATCH' | 'WF' = 'SP'): CorrelationId {
  counter++;
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(counter).padStart(6, '0');
  return `${prefix}-${dateStr}-${seq}`;
}

/**
 * Tüm event'lerin temel arayüzü
 */
export interface BaseEvent {
  /** Benzersiz işlem kimliği */
  correlationId: CorrelationId;
  /** Event zamanı */
  timestamp: string;
  /** Event'i tetikleyen kaynak */
  source: string;
}

// ==================== STOCK PROTECTION EVENT'LERİ ====================

/**
 * XML Import sonrası ürün stoğu değiştiğinde tetiklenir.
 * StockProtectionEngine bu event'i dinler.
 * Finans modülü de dinleyebilir (maliyet takibi için).
 */
export interface ProductStockChangedEvent extends BaseEvent {
  type: 'ProductStockChanged';
  data: {
    xmlSourceId: string;
    xmlSourceName?: string;
    products: Array<{
      productId: string;
      sku: string;
      productName: string;
      oldStock: number;
      newStock: number;
    }>;
    totalProducts: number;
  };
}

/**
 * StockProtectionEngine bir karar verdiğinde tetiklenir.
 * MarketplaceAdapter bu event'i dinler.
 * Dashboard bu event ile canlı güncellenir.
 */
export interface StockProtectionDecisionEvent extends BaseEvent {
  type: 'StockProtectionDecision';
  data: {
    productId: string;
    sku: string;
    productName: string;
    marketplaceKey: string;
    marketplaceName?: string;
    decision: 'CLOSE' | 'OPEN' | 'SKIP';
    reason: string;
    currentStock: number;
    criticalLevel: number;
    criticalLevelSource: 'product' | 'marketplace' | 'global';
    action: 'CLOSED' | 'OPENED' | null;
  };
}

/**
 * Marketplace adapter API çağrısı tamamlandığında tetiklenir.
 * Log sistemi bu event'i dinler.
 * Bildirim merkezi hataları bu event'ten alır.
 */
export interface MarketplaceResponseEvent extends BaseEvent {
  type: 'MarketplaceResponse';
  data: {
    marketplaceKey: string;
    adapterName: string;
    operation: 'closeListing' | 'openListing' | 'updateStock' | 'health';
    sku: string;
    success: boolean;
    durationMs: number;
    httpStatus?: number;
    error?: string;
    retryCount: number;
    triggerType: string;
  };
}

/**
 * Acil durum modu değiştiğinde tetiklenir.
 */
export interface EmergencyStopEvent extends BaseEvent {
  type: 'EmergencyStop';
  data: {
    active: boolean;
    triggeredBy?: string;
  };
}

/**
 * Adapter sağlık puanı güncellendiğinde tetiklenir.
 * Dashboard bu event ile canlı güncellenir.
 */
export interface HealthScoreUpdatedEvent extends BaseEvent {
  type: 'HealthScoreUpdated';
  data: {
    marketplaceKey: string;
    marketplaceName: string;
    successRate: number;
    averageLatency: number;
    todayErrors: number;
    healthy: boolean;
  };
}

// ==================== WORKFLOW EVENT'LERİ V2.0 ====================
// Event + WorkflowState zinciri
// KURAL 10: Modüller birbirini doğrudan çağırmaz, event yayınlar.
// Cascade: Kategori → Marka → Varyant → Şablon → ReadyToSend
// ================================================================

/**
 * WorkflowState değiştiğinde tetiklenir.
 * AutoRecalculationEngine bu event'i dinler.
 * Dashboard, Ürün Hazırlama, Gönderime Hazır güncellenir.
 */
export interface WorkflowStateChangedEvent extends BaseEvent {
  type: 'WorkflowStateChanged';
  data: {
    productId: string;
    oldStatus: string;
    newStatus: string;
    oldReadiness: number;
    newReadiness: number;
    changedFields: string[];
    triggerModule: 'CATEGORY' | 'BRAND' | 'VARIANT' | 'TEMPLATE' | 'READY_TO_SEND' | 'IMPORT' | 'MANUAL';
    cascadeChain: string[];
  };
}

/**
 * Kategori eşleştirme durumu değiştiğinde tetiklenir.
 * Workflow cascade'i başlatır: Kategori → Marka → Varyant → Şablon → ReadyToSend
 */
export interface CategoryMatchChangedEvent extends BaseEvent {
  type: 'CategoryMatchChanged';
  data: {
    productIds: string[];
    productCount: number;
    oldValue: boolean;
    newValue: boolean;
    source: 'ai' | 'manual' | 'bulk';
    triggeredBy?: string;
  };
}

/**
 * Marka eşleştirme durumu değiştiğinde tetiklenir.
 * Workflow cascade'i başlatır: Marka → Varyant → Şablon → ReadyToSend
 */
export interface BrandMatchChangedEvent extends BaseEvent {
  type: 'BrandMatchChanged';
  data: {
    productIds: string[];
    productCount: number;
    oldValue: boolean;
    newValue: boolean;
    source: 'ai' | 'manual' | 'bulk';
    triggeredBy?: string;
  };
}

/**
 * Varyant eşleştirme durumu değiştiğinde tetiklenir.
 * Workflow cascade'i başlatır: Varyant → Şablon → ReadyToSend
 */
export interface VariantMatchChangedEvent extends BaseEvent {
  type: 'VariantMatchChanged';
  data: {
    productIds: string[];
    productCount: number;
    oldValue: boolean;
    newValue: boolean;
    source: 'ai' | 'manual' | 'auto';
    triggeredBy?: string;
  };
}

/**
 * Şablon eşleştirme durumu değiştiğinde tetiklenir.
 * Workflow cascade'i başlatır: Şablon → ReadyToSend
 */
export interface TemplateMatchChangedEvent extends BaseEvent {
  type: 'TemplateMatchChanged';
  data: {
    productIds: string[];
    productCount: number;
    oldValue: boolean;
    newValue: boolean;
    source: 'manual' | 'auto';
    triggeredBy?: string;
  };
}

/**
 * AutoRecalculationEngine tetiklendiğinde yayınlanır.
 * Dashboard ve UI güncellemeleri bu event'i dinler.
 */
export interface RecalculationTriggeredEvent extends BaseEvent {
  type: 'RecalculationTriggered';
  data: {
    productId: string;
    trigger: string;
    steps: Array<{ name: string; durationMs: number; changed: boolean }>;
    totalDurationMs: number;
    result: 'SUCCESS' | 'FAILED';
    readiness: number;
  };
}

/**
 * Dashboard güncellenmesi gerektiğinde tetiklenir.
 * Tüm ekranlar aynı veriyi göstermesi için cache temizlenir.
 */
export interface DashboardRefreshEvent extends BaseEvent {
  type: 'DashboardRefresh';
  data: {
    reason: string;
    affectedProductIds?: string[];
    affectedModules?: string[];
  };
}

// ==================== BİRLEŞİK EVENT TİPİ ====================

export type AppEvent =
  | ProductStockChangedEvent
  | StockProtectionDecisionEvent
  | MarketplaceResponseEvent
  | EmergencyStopEvent
  | HealthScoreUpdatedEvent
  | WorkflowStateChangedEvent
  | CategoryMatchChangedEvent
  | BrandMatchChangedEvent
  | VariantMatchChangedEvent
  | TemplateMatchChangedEvent
  | RecalculationTriggeredEvent
  | DashboardRefreshEvent;

// ==================== EVENT HANDLER TİPİ ====================

export type EventHandler<T extends AppEvent = AppEvent> = (event: T) => void | Promise<void>;
