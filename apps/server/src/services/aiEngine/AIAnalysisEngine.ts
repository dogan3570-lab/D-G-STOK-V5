// ==================== AI EKSİK BİLGİ MERKEZİ V1.0 ====================
// DG STOK V5.0 - AI destekli eksik bilgi tespit ve düzeltme
// ======================================================================

import { prisma } from '../../db/prisma.ts';

export interface AIAnalysisResult {
  productId: string;
  productName: string;
  checks: {
    xml: { ok: boolean; message: string };
    category: { ok: boolean; message: string; suggestion?: string; confidence?: number };
    brand: { ok: boolean; message: string; suggestion?: string; confidence?: number };
    variant: { ok: boolean; message: string; suggestion?: string };
    barcode: { ok: boolean; message: string };
    description: { ok: boolean; message: string; length?: number };
    seo: { ok: boolean; message: string };
    images: { ok: boolean; message: string; quality?: number };
    forbiddenWords: { ok: boolean; message: string; words?: string[] };
    price: { ok: boolean; message: string; suggestedPrice?: number };
    template: { ok: boolean; message: string };
  };
  ready: boolean;
  totalIssues: number;
}

export class AIAnalysisEngine {
  
  static async analyzeProduct(productId: string): Promise<AIAnalysisResult> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true, brand: true,
        variants: true, xmlSource: true,
      },
    });

    const name = product?.title || product?.xmlKey || 'Bilinmeyen Ürün';
    const checks: any = {};

    // XML
    checks.xml = { ok: !!product, message: product ? 'XML kaynağı mevcut' : 'XML kaynağı bulunamadı' };

    // Kategori
    checks.category = {
      ok: !!product?.categoryId,
      message: product?.categoryId ? `Kategori: ${product.category?.name || 'Eşleşmiş'}` : 'Kategori eşleşmemiş',
      suggestion: product?.categoryId ? undefined : getCategorySuggestion(product?.title || ''),
      confidence: product?.categoryId ? undefined : 85,
    };

    // Marka
    checks.brand = {
      ok: !!product?.brandId,
      message: product?.brandId ? `Marka: ${product.brand?.name || 'Eşleşmiş'}` : 'Marka eşleşmemiş',
      suggestion: product?.brandId ? undefined : getBrandSuggestion(product?.title || ''),
      confidence: product?.brandId ? undefined : 90,
    };

    // Varyant
    checks.variant = {
      ok: (product?.variants?.length ?? 0) > 0,
      message: (product?.variants?.length ?? 0) > 0 ? `${product!.variants!.length} varyant` : 'Varyant bulunamadı',
      suggestion: (product?.variants?.length ?? 0) > 0 ? undefined : 'Renk, Beden, Numara gibi varyantlar eklenmeli',
    };

    // Barkod
    checks.barcode = {
      ok: !!product?.barcode,
      message: product?.barcode ? `Barkod: ${product.barcode}` : 'Barkod eksik',
    };

    // Açıklama
    const descLength = product?.description?.length || 0;
    checks.description = {
      ok: descLength > 50,
      message: descLength > 50 ? `Açıklama: ${descLength} karakter` : 'Açıklama çok kısa (50 karakterden az)',
      length: descLength,
    };

    // SEO
    checks.seo = {
      ok: !!product?.seoTitle || !!product?.seoDescription,
      message: (product?.seoTitle || product?.seoDescription) ? 'SEO bilgileri mevcut' : 'SEO başlık/açıklama eksik',
    };

    // Görsel
    const imageCount = product?.images ? product.images.split(',').filter(Boolean).length : 0;
    checks.images = {
      ok: imageCount >= 3,
      message: imageCount >= 3 ? `${imageCount} görsel` : `Yetersiz görsel (${imageCount}/3)`,
      quality: imageCount >= 3 ? 100 : Math.round((imageCount / 3) * 100),
    };

    // Yasaklı kelime
    const forbiddenWords = ['orijinal', 'gerçek deri', 'muadil', 'en kaliteli', 'birinci sınıf'];
    const foundWords = forbiddenWords.filter(w => 
      product?.description?.toLowerCase().includes(w) || product?.title?.toLowerCase().includes(w)
    );
    checks.forbiddenWords = {
      ok: foundWords.length === 0,
      message: foundWords.length === 0 ? 'Yasaklı kelime yok' : `Yasaklı kelime: ${foundWords.join(', ')}`,
      words: foundWords,
    };

    // Fiyat
    checks.price = {
      ok: (product?.salePrice ?? 0) > 0,
      message: (product?.salePrice ?? 0) > 0 ? `Satış: ${product!.salePrice}TL` : 'Satış fiyatı eksik',
      suggestedPrice: (product?.purchasePrice ?? 0) * 1.3,
    };

    // Şablon
    checks.template = {
      ok: false,
      message: 'Listeleme şablonu kontrol edilmeli',
    };

    const results = Object.values(checks) as Array<{ ok: boolean }>;
    const totalIssues = results.filter(r => !r.ok).length;
    const ready = totalIssues === 0;

    return {
      productId,
      productName: name,
      checks,
      ready,
      totalIssues,
    };
  }
}

function getCategorySuggestion(title: string): string {
  const categories: Record<string, string> = {
    ayakkabı: 'Ayakkabı > Erkek > Sneaker',
    elbise: 'Giyim > Kadın > Elbise',
    pantolon: 'Giyim > Erkek > Pantolon',
    telefon: 'Elektronik > Cep Telefonu',
    bilgisayar: 'Elektronik > Bilgisayar',
    kitap: 'Kitap > Edebiyat',
    oyuncak: 'Oyuncak > Puzzle',
    spor: 'Spor > Spor Ayakkabı',
  };
  for (const [key, value] of Object.entries(categories)) {
    if (title.toLowerCase().includes(key)) return value;
  }
  return 'Genel > Diğer';
}

function getBrandSuggestion(title: string): string {
  const brands = ['Nike', 'Adidas', 'Puma', 'LC Waikiki', 'Mavi', 'Koton', 'Defacto', 'Columbia', 'Hugo Boss'];
  for (const brand of brands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return 'DG STORE';
}
