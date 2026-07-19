// ==================== LEGACY XMLV2 TYPES (Compatibility Shim) ====================
// Bu dosya, provider'ların legacy xmlv2/types.ts import'larını karşılamak için
// oluşturulmuştur. Gerçek tip tanımları legacy/services/xmlv2/types.ts'de bulunur.
// ==============================================================================

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

export interface QualityScore {
  overall: number;
  category: number;
  brand: number;
  variant: number;
  content: number;
  image: number;
  price: number;
}

export interface QualityResult {
  productKey: string;
  score: QualityScore;
  issues: string[];
  improvements: string[];
}
