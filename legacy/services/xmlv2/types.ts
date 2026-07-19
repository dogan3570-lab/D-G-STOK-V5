// ==================== XML MOTORU V2 - TIP TANIMLARI ====================
// DG STOK V5.0 - Faz 1: XML Motoru V2 + Veri Kalite Merkezi
// ======================================================================

// Desteklenen kaynak tipleri
export type SourceType = 'xml' | 'json' | 'csv' | 'excel' | 'ftp' | 'sftp' | 'http' | 'https';

// Kaynak yapilandirmasi
export interface SourceConfig {
  type: SourceType;
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string; // Şifrelenmiş
  privateKey?: string; // Şifrelenmiş (SFTP)
  filePath?: string;
  encoding?: string;
  delimiter?: string; // CSV için
  sheetName?: string; // Excel için
}

// XML Motoru V2 girdi urun
export interface XmlV2Product {
  xmlKey: string;
  title: string | null;
  sku: string;
  barcode: string | null;
  stock: number;
  minStock: number;
  price: number | null;
  listPrice: number | null;
  tax: number | null;
  currency: string | null;
  brand: string | null;
  category: string | null;
  mainCategory: string | null;
  topCategory: string | null;
  subCategory: string | null;
  description: string | null;
  detail: string | null;
  images: string | null;
  link: string | null;
  unit: string | null;
  active: boolean;
  variants?: Array<{ name: string; value: string }>;
}

// ==================== KALITE PUANI ====================

export interface QualityScore {
  overall: number; // 0-100 genel puan
  category: number;
  brand: number;
  variant: number;
  barcode: number;
  stock: number;
  price: number;
  image: number;
  content: number;
  integrity: number;
  details: QualityDetail[];
}

export interface QualityDetail {
  field: string;
  score: number;
  weight: number;
  status: 'perfect' | 'good' | 'warning' | 'error';
  message: string;
}

export type ScoreLevel = 'mukemmel' | 'iyi' | 'orta' | 'dusuk' | 'kritik';

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 90) return 'mukemmel';
  if (score >= 70) return 'iyi';
  if (score >= 50) return 'orta';
  if (score >= 30) return 'dusuk';
  return 'kritik';
}

export function getScoreStars(score: number): string {
  if (score >= 90) return '⭐⭐⭐⭐⭐';
  if (score >= 70) return '⭐⭐⭐⭐';
  if (score >= 50) return '⭐⭐⭐';
  if (score >= 30) return '⭐⭐';
  return '⭐';
}

// ==================== VARYANT MOTORU V2 ====================

export type VariantDecision =
  | 'AUTO_ACCEPTED'      // XML varyantlari gecerli, otomatik kabul
  | 'AUTO_CREATED'       // AI ile olusturuldu
  | 'VARIANTSIZ_KABUL'   // Varyant gereksiz, varyantsiz kabul
  | 'MANUAL_REVIEW'      // Gercekten cozulemedi
  | 'NO_VARIANT_NEEDED'; // Kategori varyant gerektirmiyor

export interface VariantAnalysisV2 {
  productId: string;
  decision: VariantDecision;
  confidence: number; // 0-100 guven skoru
  reason: string;     // Karar nedeni (log icin)
  checks: VariantCheck[];
  suggestedVariants?: Array<{ name: string; value: string }>;
  source: 'xml' | 'ai' | 'manual';
}

export interface VariantCheck {
  name: string;
  passed: boolean;
  detail: string;
}

// ==================== KARAR LOG ====================

export interface DecisionLog {
  productId: string;
  module: string; // CATEGORY | BRAND | VARIANT | QUALITY | CONTENT
  action: string;
  reason: string;
  confidence: number;
  oldValue?: string;
  newValue?: string;
  actorUserId?: string;
  autoApplied: boolean;
  createdAt: Date;
}

// ==================== XML KALITE RAPORU ====================

export interface XmlQualityReport {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  totalProducts: number;
  overallScore: QualityScore;
  productScores: Array<{
    xmlKey: string;
    title: string | null;
    trustScore: number; // 0-100 guven skoru
    variantDecision: VariantDecision | null;
    issues: string[];
    warnings: string[];
  }>;
  summary: {
    perfect: number;  // score >= 90
    good: number;     // score >= 70
    warning: number;  // score >= 50
    error: number;    // score < 50
    readinessRate: number; // yuzde kaci gonderime hazir
  };
  analyzedAt: Date;
}
