// ==================== VARYANT MOTORU V5.0 - CONSTANTS ====================
// DG STOK V5.0 - Category-Based Smart Variant Engine
// ================================================================

import type { VariantAttributeType, PipelineConfig } from './types.ts';

// ==================== PIPELINE ====================

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  batchSize: 200,
  maxRetries: 3,
  checkpointInterval: 1,     // Her batch'te checkpoint
  enableWorkers: false,
  workerConcurrency: 1,
};

// ==================== EŞİK DEĞERLERİ ====================

export const THRESHOLDS = {
  AUTO_APPROVE_CONFIDENCE: 95,     // ≥95 → AUTO_APPROVED
  AUTO_CREATE_CONFIDENCE: 85,      // ≥85 → AUTO_CREATED
  AI_ANALYSIS_CONFIDENCE: 70,      // ≥70 → AI analizine gönder
  MANUAL_REVIEW_CONFIDENCE: 50,    // <50 → MANUAL_REVIEW
  FAMILY_MATCH_CONFIDENCE: 80,     // Aile eşleşmesi için min güven
  EXTRACTION_CONFIDENCE: 60,       // Attribute çıkarımı için min güven
} as const;

// ==================== VARYANT ATTRIBUTE ANAHTAR KELİMELERİ (Madde 10) ====================

export const VARIANT_KEYWORDS: Record<VariantAttributeType, string[]> = {
  RENK: ['renk', 'color', 'colour', 'siyah', 'beyaz', 'kırmızı', 'mavi', 'yeşil',
    'sarı', 'mor', 'turuncu', 'pembe', 'gri', 'lacivert', 'bordo', 'bej',
    'kahverengi', 'krem', 'füme', 'metalik', 'altın', 'gümüş', 'turkuaz',
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 'pink',
    'gray', 'grey', 'brown', 'beige', 'navy', 'burgundy', 'silver', 'gold',
    'orange', 'multicolor'],
  BEDEN: ['xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl',
    'xxxl', 'small', 'medium', 'large', 'xlarge', 'xxlarge',
    '32', '34', '36', '38', '40', '42', '44', '46', '48', '50',
    '52', '54', '56', '58', '60', 'beden', 'size'],
  NUMARA: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45',
    '46', '47', '48', '49', '50', 'numara', 'number', 'no'],
  HACIM: ['litre', 'lt', 'l', 'ml', 'cc', 'hacim', 'volume'],
  UZUNLUK: ['metre', 'm', 'cm', 'mm', 'mt', 'uzunluk', 'length', 'height', 'boy'],
  AGIRLIK: ['kg', 'gr', 'gram', 'kilogram', 'ağırlık', 'weight'],
  PAKET: ['paket', 'adet', 'li', 'lı', 'set'],
  BOY: ['boy', 'height', 'cm', 'metre'],
  EN: ['en', 'width', 'cm', 'mm'],
  CAP: ['çap', 'cap', 'diameter', 'mm', 'cm'],
  LITRE: ['litre', 'lt', 'l', 'ml'],
  ML: ['ml', 'mililitre'],
  GRAM: ['gr', 'g', 'gram'],
  METRE: ['metre', 'm', 'mt'],
  CM: ['cm', 'santim'],
  MM: ['mm', 'milimetre'],
  ADET: ['adet', 'li', 'lı'],
  SET: ['set', 'takım'],
  CIFT: ['çift', 'pair'],
};

// ==================== RENK/BEDEN/NUMARA DESENLERİ ====================

export const PATTERNS = {
  // "Siyah", "Beyaz", "Kırmızı" gibi renk kelimeleri
  COLOR_WORD: /\b(Siyah|Beyaz|Kırmızı|Mavi|Yeşil|Sarı|Mor|Turuncu|Pembe|Gri|Lacivert|Bordo|Bej|Kahverengi|Krem|Füme|Metalik|Altın|Gümüş|Turkuaz|Black|White|Red|Blue|Green|Yellow|Purple|Pink|Gray|Grey|Brown|Beige|Navy|Burgundy|Silver|Gold|Orange|Multicolor)\b/gi,

  // "42", "44", "S", "M", "L", "XL" gibi beden/no
  SIZE_NUMBER: /\b(\d{2})\s*(?:cm|mm|m|mt)?\b/g,

  // Model adı çıkarma: marka + ürün adı (renk/beden/no olmayan kısım)
  MODEL_NAME: /^(.+?)(?:\s+(?:Siyah|Beyaz|Kırmızı|Mavi|Yeşil|Sarı|Mor|Turuncu|Pembe|Gri|Lacivert|Bordo|Bej|Kahverengi|Krem|Füme|S|M|L|XL|XXL|\d{2})\b.*)?$/i,
} as const;

// ==================== KATEGORİ VARSAYILAN YAPILANDIRMALARI ====================

export const CATEGORY_VARIANT_REQUIRED_FALSE_KEYWORDS = [
  'kılıf', 'kapak', 'aksesuar', 'hoparlör', 'hoparlor', 'kulaklık', 'kulaklik',
  'kablo', 'şarj', 'saric', 'adaptör', 'adapter', 'koruyucu', 'ekran',
  'bardak', 'kase', 'tabak', 'çatal', 'kaşık', 'bıçak', 'mutfak', 'baharat',
  'saksı', 'çiçek', 'dekorasyon', 'hediyelik', 'oyuncak', 'lamba', 'ampul',
  'led', 'aydınlatma', 'kamera', 'güvenlik', 'alarm', 'sensör',
  'masaj', 'tıraş', 'tiras', 'makine', 'cihaz', 'alet',
  'kalem', 'defter', 'kitap', 'kağıt', 'kagit',
  'temizlik', 'deterjan', 'sabun', 'şampuan', 'sampuan',
  'saç', 'sac', 'tırnak', 'tirnak', 'manikür', 'manikur', 'pedikür', 'pedikur',
] as const;

// ==================== KATEGORİ VARYANT GEREKTİREN ANAHTAR KELİMELER ====================

export const CATEGORY_VARIANT_REQUIRED_TRUE_KEYWORDS = [
  'ayakkabı', 'ayakkabi', 'bot', 'spor', 'terlik', 'çizme', 'cizme',
  'tişört', 'tisort', 'gömlek', 'gomlek', 'pantolon', 'elbise', 'etek',
  'ceket', 'mont', 'yelek', 'kazak', 'süveter', 'suveter', 'hırka', 'hirka',
  'çorap', 'corap', 'iç giyim', 'ic giyim', 'takım', 'takim',
  'mayo', 'bikini', 'şort', 'sort', 'tayt',
] as const;

// ==================== LOGLAMA ====================

export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;

// ==================== VERİTABANI ====================

export const DB = {
  PRODUCT_TABLE: 'Product',
  VARIANT_ANALYSIS_TABLE: 'VariantAnalysis',
  DECISION_LOG_TABLE: 'DecisionLog',
} as const;
