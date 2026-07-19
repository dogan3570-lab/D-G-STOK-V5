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
export function createCorrelationId(prefix: 'SP' | 'XML' | 'MP' | 'API' | 'BATCH' | 'WF' | 'AI' = 'SP'): CorrelationId {
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

// ==================== XML IMPORT EVENT'LERİ ====================

/**
 * XML import tamamlandığında tetiklenir.
 * Product Pipeline bu event ile başlar.
 */
export interface ProductImportCompletedEvent extends BaseEvent {
  type: 'ProductImportCompleted';
  data: {
    productIds: string[];
    sourceName: string;
    totalItems: number;
    importedCount: number;
    updatedCount: number;
  };
}

// ==================== AI IMAGE QUALITY CENTER EVENT'LERİ ====================

/**
 * Görsel analizi tamamlandığında tetiklenir.
 */
export interface ImageAnalyzedEvent extends BaseEvent {
  type: 'ImageAnalyzed';
  data: {
    productId?: string;
    imageUrl?: string;
    overallScore?: number;
    status?: string;
    issueCount?: number;
    analysisId?: string;
    productIds?: string[];
    totalCount?: number;
    batchAnalysis?: boolean;
    totalProcessed?: number;
    successful?: number;
    failed?: number;
    results?: Array<{
      productId: string;
      imageUrl: string;
      score: number;
      status: string;
    }>;
    batchCompleted?: boolean;
  };
}

/**
 * Görselde sorun tespit edildiğinde tetiklenir.
 */
export interface ImageIssueDetectedEvent extends BaseEvent {
  type: 'ImageIssueDetected';
  data: {
    productId: string;
    imageUrl?: string;
    analysisId?: string;
    issues: Array<{
      issueType: string;
      severity: string;
      confidence: number;
      description: string;
    }>;
    overallScore: number;
  };
}

/**
 * Görsel sorunu onaylandığında tetiklenir.
 */
export interface ImageApprovedEvent extends BaseEvent {
  type: 'ImageApproved';
  data: {
    issueId: string;
    issueType: string;
    severity: string;
    approved: boolean;
  };
}

/**
 * Görsel reddedildiğinde tetiklenir.
 */
export interface ImageRejectedEvent extends BaseEvent {
  type: 'ImageRejected';
  data: {
    issueId: string;
    issueType: string;
    severity: string;
    approved: boolean;
  };
}

// ==================== AI SALES ADVISOR EVENT'LERİ ====================

export interface PriceRecommendationCreatedEvent extends BaseEvent {
  type: 'PriceRecommendationCreated';
  data: {
    productId: string;
    marketplace?: string;
    currentPrice: number;
    recommendedPrice: number;
    recommendation: string;
    confidence: number;
    reportId?: string;
  };
}

export interface PriceRecommendationApprovedEvent extends BaseEvent {
  type: 'PriceRecommendationApproved';
  data: {
    reportId: string;
    productId: string;
    marketplace?: string;
    oldPrice: number;
    newPrice: number;
    approved: boolean;
  };
}

export interface PriceRecommendationRejectedEvent extends BaseEvent {
  type: 'PriceRecommendationRejected';
  data: {
    reportId: string;
    productId: string;
    marketplace?: string;
    oldPrice: number;
    newPrice: number;
    approved: boolean;
  };
}

export interface ProfitChangedEvent extends BaseEvent {
  type: 'ProfitChanged';
  data: {
    productId: string;
    marketplace?: string;
    oldPrice: number;
    newPrice: number;
    oldProfit: number;
    newProfit: number;
    reason: string;
  };
}

export interface CompetitionChangedEvent extends BaseEvent {
  type: 'CompetitionChanged';
  data: {
    productId: string;
    marketplace?: string;
    oldCompetitionLevel: number;
    newCompetitionLevel: number;
  };
}

// ==================== AI COPILOT EVENT'LERİ ====================

export interface CopilotRequestedEvent extends BaseEvent {
  type: 'CopilotRequested';
  data: {
    question: string;
    userId?: string;
  };
}

export interface CopilotTaskStartedEvent extends BaseEvent {
  type: 'CopilotTaskStarted';
  data: {
    taskId: string;
    module: string;
    action: string;
  };
}

export interface CopilotTaskCompletedEvent extends BaseEvent {
  type: 'CopilotTaskCompleted';
  data: {
    taskId: string;
    module: string;
    action: string;
    success: boolean;
  };
}

export interface CopilotTaskFailedEvent extends BaseEvent {
  type: 'CopilotTaskFailed';
  data: {
    taskId: string;
    module: string;
    action: string;
    error: string;
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
  | DashboardRefreshEvent
  | ProductImportCompletedEvent
  | ImageAnalyzedEvent
  | ImageIssueDetectedEvent
  | ImageApprovedEvent
  | ImageRejectedEvent
  | PriceRecommendationCreatedEvent
  | PriceRecommendationApprovedEvent
  | PriceRecommendationRejectedEvent
  | ProfitChangedEvent
  | CompetitionChangedEvent
  | CopilotRequestedEvent
  | CopilotTaskStartedEvent
  | CopilotTaskCompletedEvent
  | CopilotTaskFailedEvent;

// ==================== EVENT HANDLER TİPİ ====================

export type EventHandler<T extends AppEvent = AppEvent> = (event: T) => void | Promise<void>;
