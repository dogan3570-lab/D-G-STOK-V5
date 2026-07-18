// ==================== VARYANT MOTORU V5.0 - TYPES ====================
// DG STOK V5.0 - Category-Based Smart Variant Engine
// ================================================================

// ==================== DURUMLAR (Madde 12) ====================

export type VariantStatus =
  | 'AUTO_APPROVED'        // Otomatik onay, müdahale gerekmez
  | 'AUTO_CREATED'         // AI varyantları otomatik oluşturdu
  | 'WAITING_AI'           // AI analizi bekliyor (kuyruk)
  | 'WAITING_USER'         // Kullanıcı aksiyonu bekliyor
  | 'MANUAL_REVIEW'        // Manuel inceleme gerekli
  | 'ERROR'                // Hata oluştu
  | 'SKIPPED'              // Atlanmış (kural dışı)
  | 'NO_VARIANT_REQUIRED'; // Kategori varyant gerektirmiyor

// ==================== KARAR KAYNAKLARI ====================

export type DecisionSource =
  | 'CATEGORY_RULE'        // Kategori kuralı
  | 'AI_ANALYSIS'          // AI analizi
  | 'FAMILY_MATCH'         // Aile eşleştirmesi
  | 'TITLE_EXTRACTION'     // Başlık çıkarımı
  | 'DESCRIPTION_EXTRACTION' // Açıklama çıkarımı
  | 'XML_ANALYSIS'         // XML analizi
  | 'MARKETPLACE_RULE'     // Pazaryeri kuralı
  | 'MANUAL';              // Manuel müdahale

// ==================== VARYANT ATTRIBUTE TİPLERİ (Madde 10) ====================

export type VariantAttributeType =
  | 'RENK'
  | 'BEDEN'
  | 'NUMARA'
  | 'HACIM'
  | 'UZUNLUK'
  | 'AGIRLIK'
  | 'PAKET'
  | 'BOY'
  | 'EN'
  | 'CAP'
  | 'LITRE'
  | 'ML'
  | 'GRAM'
  | 'METRE'
  | 'CM'
  | 'MM'
  | 'ADET'
  | 'SET'
  | 'CIFT';

// =================== KATEGORİ YAPISI (Madde 8) ====================

export interface CategoryVariantConfig {
  categoryId: string;
  categoryName: string;
  variantRequired: boolean;
  requiredVariantTypes: VariantAttributeType[];
  allowNoVariant: boolean;
  allowSingleVariant: boolean;
  minimumVariantCount: number;
  maximumVariantCount: number;
  supportedVariantTypes: VariantAttributeType[];
}

// =================== ÜRÜN ====================

export interface V5Product {
  id: string;
  xmlKey: string;
  title: string | null;
  originalTitle: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  salePrice: number | null;
  purchasePrice: number | null;
  description: string | null;
  supplierCategory: string | null;
  images: string | null;
  categoryId: string | null;
  brandId: string | null;
  xmlSourceId: string | null;
  variantStatus: string;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string } | null;
  variants: Array<{ id: string; name: string; value: string }>;
}

// =================== ÇIKARILAN VARYANT ATTRIBUTE'LERİ ====================

export interface ExtractedVariant {
  type: VariantAttributeType;
  value: string;
  confidence: number;       // 0-100
  source: DecisionSource;
  rawMatch: string;         // Eşleşen orijinal metin
}

// =================== ÜRÜN AİLESİ (Madde 9) ====================

export interface ProductFamily {
  id: string;
  modelName: string;        // Örn: "Nike Air Max"
  brandName: string | null;
  categoryName: string | null;
  products: Array<{
    productId: string;
    extractedVariants: ExtractedVariant[];
  }>;
  confidence: number;
}

// =================== KARAR ====================

export interface VariantDecision {
  productId: string;
  status: VariantStatus;
  confidence: number;        // 0-100
  source: DecisionSource;
  reason: string;
  extractedVariants: ExtractedVariant[];
  familyId: string | null;
  errors: string[];
  warnings: string[];
  categoryConfig: CategoryVariantConfig | null;
  timestamp: string;
}

// =================== KARAR LOGU (Madde 13) ====================

export interface DecisionLog {
  id: string;
  productId: string;
  productTitle: string | null;
  xmlKey: string;
  decision: VariantStatus;
  source: DecisionSource;
  confidence: number;
  reason: string;
  rule: string;
  categoryName: string | null;
  aiResult: string | null;
  xmlResult: string | null;
  familyResult: string | null;
  extractedData: string | null;  // JSON
  createdAt: Date;
}

// =================== PAZARYERİ KURALLARI (Madde 15) ====================

export interface MarketplaceVariantRule {
  marketplaceKey: string;
  categoryId: string | null;
  requiredVariantTypes: VariantAttributeType[];
  supportedVariantTypes: VariantAttributeType[];
  maxVariantCount: number;
}

// =================== PIPELINE ====================

export interface PipelineConfig {
  batchSize: number;           // Varsayılan: 200
  maxRetries: number;          // Varsayılan: 3
  checkpointInterval: number;  // Her batch'te checkpoint
  enableWorkers: boolean;
  workerConcurrency: number;
}

export interface PipelineState {
  id: string;
  xmlSourceId: string | null;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  processedCount: number;
  totalCount: number;
  currentCursor: string | null;
  errors: string[];
  startedAt: Date;
  completedAt: Date | null;
}

export interface PipelineResult {
  processedCount: number;
  decisions: VariantDecision[];
  stats: {
    autoApproved: number;
    autoCreated: number;
    waitingAI: number;
    waitingUser: number;
    manualReview: number;
    error: number;
    skipped: number;
    noVariantRequired: number;
  };
  duration: number;  // ms
}

// =================== AI ÇIKARIM SONUCU ====================

export interface AIExtractionResult {
  productId: string;
  extractedVariants: ExtractedVariant[];
  confidence: number;
  modelName: string | null;    // Çıkarılan model adı
  suggestedFamilyId: string | null;
  canAutoCreate: boolean;
  reason: string;
}
