// ==================== VARYANT MOTORU V4.0 - TYPES ====================
// DG STOK V5.0 - Universal XML Profile Engine + Smart Variant Engine

export interface V4ProductWithRelations {
  id: string;
  sku: string | null;
  xmlKey: string;
  title: string | null;
  barcode: string | null;
  brandId: string | null;
  categoryId: string | null;
  supplierCategory: string | null;
  purchasePrice: number | null;
  salePrice: number | null;
  stock: number;
  status: string;
  description: string | null;
  xmlSourceId?: string | null;
  brand?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string } | null;
  variants: Array<{ id: string; name: string; value: string }>;
}

export interface XmlProfileResult {
  profileName: string;
  xmlType: 'DISTRIBUTED_VARIANT' | 'SIMPLE' | 'FLAT' | 'UNKNOWN';
  parentSkuRate: number;
  groupIdRate: number;
  variationThemeRate: number;
  colorRate: number;
  sizeRate: number;
  numberRate: number;
  barcodeRate: number;
  skuRate: number;
  titleQuality: number;
  categoryQuality: number;
  attributeQuality: number;
  dgMode: 'AUTO' | 'SEMI_AUTO' | 'MANUAL';
  canAutoCreate: boolean;
  confidence: number;
}

export interface V4AnalysisResult {
  productId: string;
  confidence: number;
  source: 'XML_PARENT' | 'AI_MATCH' | 'AUTO_CREATED' | 'NO_VARIANT_NEEDED' | 'MANUAL';
  status: 'AUTO_ACCEPTED' | 'AUTO_CREATED' | 'RE_ANALYZED' | 'MANUAL_REVIEW' | 'ERROR';
  reason: string | null;
  parentSku: string | null;
  groupId: string | null;
  xmlHasParent: boolean;
  familyId: string | null;
  phase: number;
  checks: Record<string, boolean>;
  errors: string[];
  warnings: string[];
  validationPassed: boolean;
}

export interface V4FamilyInfo {
  id: string;
  parentSku: string;
  groupId: string;
  productCount: number;
  confidence: number;
  members: Array<{
    productId: string;
    attributeName: string | null;
    attributeValue: string | null;
  }>;
}

export interface V4Stats {
  totalProducts: number;
  xmlAccepted: number;
  noVariantNeeded: number;
  autoCreated: number;
  reAnalyzed: number;
  manualReview: number;
  errors: number;
}

export interface V4ScreenProduct {
  id: string;
  sku: string | null;
  xmlKey: string;
  title: string | null;
  barcode: string | null;
  brandName: string | null;
  categoryName: string | null;
  xmlSourceName: string | null;
  confidence: number;
  status: string;
  reason: string | null;
  suggestedAction: string | null;
  hasColor: boolean;
  hasSize: boolean;
  hasNumber: boolean;
  parentSku: string | null;
  groupId: string | null;
  familyId: string | null;
  errorCount: number;
  issueType: string | null;
}

export const V4_CONSTANTS = {
  XML_VARIANT_FIELDS: [
    'parentsku', 'parent_sku', 'parent sku', 'parentid', 'parent_id',
    'variantgroup', 'variant_group', 'groupid', 'group_id',
    'itemgroupid', 'item_group_id', 'variationtheme', 'variation_theme',
    'color', 'colour', 'renk',
    'size', 'beden',
    'number', 'numara', 'no',
    'model', 'model_no',
  ],

  COLOR_KEYWORDS: [
    'siyah', 'beyaz', 'kırmızı', 'mavi', 'yeşil', 'sarı', 'mor', 'turuncu',
    'pembe', 'gri', 'lacivert', 'bordo', 'bej', 'kahverengi', 'krem', 'füme',
    'metalik', 'altın', 'gümüş', 'turkuaz', 'black', 'white', 'red', 'blue',
    'green', 'yellow', 'purple', 'pink', 'gray', 'grey', 'brown', 'beige',
    'navy', 'burgundy', 'silver', 'gold', 'orange', 'multicolor',
  ],

  SIZE_KEYWORDS: [
    'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl',
    'xxxl', 'small', 'medium', 'large', 'xlarge', 'xxlarge',
    '32', '34', '36', '38', '40', '42', '44', '46', '48', '50',
    '52', '54', '56', '58', '60',
  ],

  NUMBER_KEYWORDS: [
    '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45',
    '46', '47', '48', '49', '50',
  ],

  // Eşik değerleri
  THRESHOLD_AUTO_ACCEPT: 95,
  THRESHOLD_AUTO_CREATE: 90,
  THRESHOLD_RE_ANALYZE: 80,
  THRESHOLD_AUTO_SUGGEST: 70,
};

export const MANUAL_REVIEW_REASONS = [
  'Belirlenemeyen Ürün Ailesi',
  'Çakışan Barkod',
  'Çakışan SKU',
  'Eksik Attribute',
  'Kategori Çelişkisi',
  'Anlamsız Ürün Adı',
  'Çelişkili XML Verisi',
] as const;
