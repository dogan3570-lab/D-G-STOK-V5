import { prisma } from '../db/prisma.ts';

// ==================== KALİTE SKORU ====================

export interface QualityScore {
  total: number;
  details: {
    title: { score: number; max: number; status: 'complete' | 'partial' | 'missing' };
    description: { score: number; max: number; status: 'complete' | 'partial' | 'missing' };
    images: { score: number; max: number; status: 'complete' | 'partial' | 'missing' };
    category: { score: number; max: number; status: 'complete' | 'missing' };
    brand: { score: number; max: number; status: 'complete' | 'missing' };
    barcode: { score: number; max: number; status: 'complete' | 'missing' };
    variant: { score: number; max: number; status: 'complete' | 'missing' };
    seo: { score: number; max: number; status: 'complete' | 'missing' };
    attributes: { score: number; max: number; status: 'complete' | 'missing' };
    stock: { score: number; max: number; status: 'complete' | 'missing' };
  };
  level: 'high' | 'medium' | 'low';
}

/**
 * Bir ürünün kalite skorunu hesaplar (100 üzerinden).
 */
export function calculateQualityScore(product: {
  title: string | null;
  description: string | null;
  images: string | null;
  categoryId: string | null;
  categoryMatch: boolean;
  brandId: string | null;
  brandMatch: boolean;
  barcode: string | null;
  variantMatch: boolean;
  variantsCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  technicalSpecs: string | null;
  stock: number;
}): QualityScore {
  let score = 0;
  const details = {} as QualityScore['details'];

  // Başlık (10 puan)
  if (product.title && product.title.length >= 10) {
    score += 10;
    details.title = { score: 10, max: 10, status: 'complete' };
  } else if (product.title) {
    score += 5;
    details.title = { score: 5, max: 10, status: 'partial' };
  } else {
    details.title = { score: 0, max: 10, status: 'missing' };
  }

  // Açıklama (15 puan)
  if (product.description && product.description.length >= 50) {
    score += 15;
    details.description = { score: 15, max: 15, status: 'complete' };
  } else if (product.description) {
    score += 7;
    details.description = { score: 7, max: 15, status: 'partial' };
  } else {
    details.description = { score: 0, max: 15, status: 'missing' };
  }

  // Resim (15 puan)
  const imageCount = product.images ? product.images.split(',').filter(Boolean).length : 0;
  if (imageCount >= 3) {
    score += 15;
    details.images = { score: 15, max: 15, status: 'complete' };
  } else if (imageCount >= 1) {
    score += 8;
    details.images = { score: 8, max: 15, status: 'partial' };
  } else {
    details.images = { score: 0, max: 15, status: 'missing' };
  }

  // Kategori (10 puan)
  if (product.categoryMatch && product.categoryId) {
    score += 10;
    details.category = { score: 10, max: 10, status: 'complete' };
  } else {
    details.category = { score: 0, max: 10, status: 'missing' };
  }

  // Marka (10 puan)
  if (product.brandMatch && product.brandId) {
    score += 10;
    details.brand = { score: 10, max: 10, status: 'complete' };
  } else {
    details.brand = { score: 0, max: 10, status: 'missing' };
  }

  // Barkod (10 puan)
  if (product.barcode) {
    score += 10;
    details.barcode = { score: 10, max: 10, status: 'complete' };
  } else {
    details.barcode = { score: 0, max: 10, status: 'missing' };
  }

  // Varyant (5 puan)
  if (product.variantMatch && product.variantsCount > 0) {
    score += 5;
    details.variant = { score: 5, max: 5, status: 'complete' };
  } else {
    details.variant = { score: 0, max: 5, status: 'missing' };
  }

  // SEO (10 puan)
  const hasSeo = !!(product.seoTitle || product.seoDescription);
  if (hasSeo) {
    score += 10;
    details.seo = { score: 10, max: 10, status: 'complete' };
  } else {
    details.seo = { score: 0, max: 10, status: 'missing' };
  }

  // Öznitelikler (5 puan)
  if (product.technicalSpecs) {
    score += 5;
    details.attributes = { score: 5, max: 5, status: 'complete' };
  } else {
    details.attributes = { score: 0, max: 5, status: 'missing' };
  }

  // Stok (10 puan)
  if (product.stock > 0) {
    score += 10;
    details.stock = { score: 10, max: 10, status: 'complete' };
  } else {
    details.stock = { score: 0, max: 10, status: 'missing' };
  }

  return {
    total: score,
    details,
    level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
  };
}

// ==================== EKSİK BİLGİ TESPİTİ ====================

export interface MissingInfo {
  hasMissingCategory: boolean;
  hasMissingBrand: boolean;
  hasMissingBarcode: boolean;
  hasMissingImages: boolean;
  hasMissingDescription: boolean;
  hasMissingPrice: boolean;
  hasMissingStock: boolean;
  hasMissingVariant: boolean;
  hasMissingSeo: boolean;
  missingFields: string[];
  totalMissing: number;
}

/**
 * Bir üründe eksik bilgileri tespit eder.
 */
export function detectMissingInfo(product: {
  categoryId: string | null;
  categoryMatch: boolean;
  brandId: string | null;
  brandMatch: boolean;
  barcode: string | null;
  images: string | null;
  description: string | null;
  salePrice: number | null;
  stock: number;
  variantMatch: boolean;
  variantsCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
}): MissingInfo {
  const result: MissingInfo = {
    hasMissingCategory: !product.categoryId || !product.categoryMatch,
    hasMissingBrand: !product.brandId || !product.brandMatch,
    hasMissingBarcode: !product.barcode,
    hasMissingImages: !product.images,
    hasMissingDescription: !product.description,
    hasMissingPrice: !product.salePrice || product.salePrice <= 0,
    hasMissingStock: product.stock <= 0,
    hasMissingVariant: !product.variantMatch,
    hasMissingSeo: !product.seoTitle && !product.seoDescription,
    missingFields: [],
    totalMissing: 0,
  };

  const fieldLabels: Record<string, string> = {
    hasMissingCategory: 'Kategori',
    hasMissingBrand: 'Marka',
    hasMissingBarcode: 'Barkod',
    hasMissingImages: 'Resim',
    hasMissingDescription: 'Açıklama',
    hasMissingPrice: 'Satış Fiyatı',
    hasMissingStock: 'Stok',
    hasMissingVariant: 'Varyant',
    hasMissingSeo: 'SEO',
  };

  for (const [key, label] of Object.entries(fieldLabels)) {
    if (result[key as keyof typeof result]) {
      result.missingFields.push(label);
    }
  }

  result.totalMissing = result.missingFields.length;
  return result;
}

// ==================== KATEGORİ / MARKA TAHMİNİ ====================

/**
 * Ürün başlığına ve açıklamasına göre kategori tahmini yapar.
 * Basit bir keyword matching yaklaşımı kullanır.
 */
export function suggestCategory(title: string | null, description: string | null): string | null {
  const text = [title, description].filter(Boolean).join(' ').toLowerCase();
  if (!text) return null;

  // Basit keyword-based kategori tahmini
  const patterns: Array<{ keywords: string[]; category: string }> = [
    { keywords: ['ayakkabı', 'shoe', 'sneaker', 'boots', 'bot', 'spor ayakkabı'], category: 'Ayakkabı' },
    { keywords: ['telefon', 'cep telefonu', 'smartphone', 'iphone', 'samsung', 'xiaomi'], category: 'Telefon' },
    { keywords: ['bilgisayar', 'laptop', 'notebook', 'pc', 'macbook', 'monitor'], category: 'Bilgisayar' },
    { keywords: ['televizyon', 'tv', 'led tv', 'oled'], category: 'Televizyon' },
    { keywords: ['buzdolabı', 'derin dondurucu', 'refrigerator'], category: 'Beyaz Eşya' },
    { keywords: ['çamaşır', 'washer', 'kurulama'], category: 'Beyaz Eşya' },
    { keywords: ['kulaklık', 'headphone', 'earphone', 'bluetooth kulaklık'], category: 'Aksesuar' },
    { keywords: ['saat', 'watch', 'kol saati', 'akıllı saat'], category: 'Aksesuar' },
    { keywords: ['kitap', 'book', 'roman', 'hikaye'], category: 'Kitap' },
    { keywords: ['oyuncak', 'toy', 'leg', 'peluş'], category: 'Oyuncak' },
    { keywords: ['spor', 'sport', 'fitness', 'gym', 'dambıl'], category: 'Spor Malzemeleri' },
    { keywords: ['bebek', 'baby', 'biberon', 'bez'], category: 'Bebek Ürünleri' },
    { keywords: ['mutfak', 'kitchen', 'tava', 'tencere', 'bıçak'], category: 'Mutfak Gereçleri' },
    { keywords: ['mobilya', 'furniture', 'koltuk', 'masa', 'sandalye'], category: 'Mobilya' },
    { keywords: ['aydınlatma', 'lamba', 'led', 'avize'], category: 'Aydınlatma' },
    { keywords: ['kozmetik', 'parfüm', 'deodorant', 'krem', 'şampuan'], category: 'Kozmetik' },
    { keywords: ['giyim', 'giysi', 'elbise', 'pantolon', 'ceket', 'mont', 't-shirt', 'gömlek'], category: 'Giyim' },
    { keywords: ['çanta', 'bag', 'sırt çantası', 'el çantası'], category: 'Çanta' },
    { keywords: ['oyun', 'game', 'playstation', 'xbox', 'nintendo'], category: 'Oyun Konsolu' },
  ];

  let bestMatch: { category: string; score: number } | null = null;

  for (const pattern of patterns) {
    const matchCount = pattern.keywords.filter(k => text.includes(k)).length;
    if (matchCount > 0 && (!bestMatch || matchCount > bestMatch.score)) {
      bestMatch = { category: pattern.category, score: matchCount };
    }
  }

  return bestMatch?.category ?? null;
}

/**
 * Marka tahmini yapar.
 */
export function suggestBrand(title: string | null): string | null {
  const text = (title || '').toLowerCase();
  if (!text) return null;

  const knownBrands = [
    'samsung', 'apple', 'xiaomi', 'huawei', 'oppo', 'lg', 'sony', 'philips',
    'bosch', 'siemens', 'vestel', 'arcelik', 'beko', 'profilo', 'altus',
    'nike', 'adidas', 'puma', 'converse', 'reebok', 'new balance', 'under armour',
    'lc waikiki', 'defacto', 'mavi', 'colin\'s', 'koton', 'pull&bear', 'zara',
    'lenovo', 'hp', 'dell', 'asus', 'acer', 'msi', 'casper', 'monster',
    'canon', 'nikon', 'fujifilm', 'gopro',
    'dyson', 'bissell', 'arcelik', 'fakir',
    'l\'oreal', 'nivea', 'garnier', 'maybelline', 'flormar',
    'tony&guy', 'head&shoulders', 'dove', 'clear',
  ];

  for (const brand of knownBrands) {
    if (text.includes(brand)) {
      // İlk harfi büyük yap
      return brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return null;
}
