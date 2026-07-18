// ==================== VERI KALITE MOTORU ====================
// DG STOK V5.0 - XML Motoru V2
// Her XML kaynagi icin kalite puani ve guven skoru uretir.
// ============================================================

import { prisma } from '../../db/prisma.ts';
import type {
  QualityScore,
  QualityDetail,
  XmlV2Product,
  XmlQualityReport,
} from './types.ts';

const WEIGHTS = {
  category: 0.15,
  brand: 0.10,
  variant: 0.20,
  barcode: 0.15,
  stock: 0.05,
  price: 0.10,
  image: 0.10,
  content: 0.10,
  integrity: 0.05,
};

/**
 * Tek bir urun icin kalite puani hesaplar
 */
export function calculateProductScore(product: XmlV2Product): QualityScore {
  const details: QualityDetail[] = [];

  // 1. Kategori puani
  const categoryScore = analyzeCategory(product);
  details.push({
    field: 'category',
    score: categoryScore,
    weight: WEIGHTS.category,
    status: getStatus(categoryScore),
    message: categoryScore >= 70
      ? 'Kategori mevcut'
      : categoryScore >= 30
        ? 'Kategori eksik veya guvensiz'
        : 'Kategori bulunamadi',
  });

  // 2. Marka puani
  const brandScore = analyzeBrand(product);
  details.push({
    field: 'brand',
    score: brandScore,
    weight: WEIGHTS.brand,
    status: getStatus(brandScore),
    message: brandScore >= 70 ? 'Marka mevcut' : 'Marka eksik veya taninmiyor',
  });

  // 3. Varyant puani
  const variantScore = analyzeVariant(product);
  details.push({
    field: 'variant',
    score: variantScore,
    weight: WEIGHTS.variant,
    status: getStatus(variantScore),
    message: variantScore >= 70 ? 'Varyant durumu uygun' : 'Varyant analizi gerekli',
  });

  // 4. Barkod puani
  const barcodeScore = analyzeBarcode(product);
  details.push({
    field: 'barcode',
    score: barcodeScore,
    weight: WEIGHTS.barcode,
    status: getStatus(barcodeScore),
    message: barcodeScore >= 70 ? 'Barkod gecerli' : 'Barkod eksik veya gecersiz',
  });

  // 5. Stok puani
  const stockScore = analyzeStock(product);
  details.push({
    field: 'stock',
    score: stockScore,
    weight: WEIGHTS.stock,
    status: getStatus(stockScore),
    message: stockScore >= 70 ? 'Stok durumu uygun' : 'Stok sorunu var',
  });

  // 6. Fiyat puani
  const priceScore = analyzePrice(product);
  details.push({
    field: 'price',
    score: priceScore,
    weight: WEIGHTS.price,
    status: getStatus(priceScore),
    message: priceScore >= 70 ? 'Fiyat tutarli' : 'Fiyat sorunu var',
  });

  // 7. Gorsel puani
  const imageScore = analyzeImage(product);
  details.push({
    field: 'image',
    score: imageScore,
    weight: WEIGHTS.image,
    status: getStatus(imageScore),
    message: imageScore >= 70 ? 'Gorsel mevcut' : 'Gorsel eksik veya yetersiz',
  });

  // 8. Icerik puani
  const contentScore = analyzeContent(product);
  details.push({
    field: 'content',
    score: contentScore,
    weight: WEIGHTS.content,
    status: getStatus(contentScore),
    message: contentScore >= 70 ? 'Icerik kalitesi iyi' : 'Icerik iyilestirilmeli',
  });

  // 9. Veri butunlugu puani
  const integrityScore = analyzeIntegrity(product);
  details.push({
    field: 'integrity',
    score: integrityScore,
    weight: WEIGHTS.integrity,
    status: getStatus(integrityScore),
    message: integrityScore >= 70 ? 'Veri butunlugu tam' : 'Veri tutarsizligi var',
  });

  // Agirlikli ortalama
  const overall = Math.round(
    details.reduce((sum, d) => sum + d.score * d.weight, 0)
  );

  return {
    overall,
    category: categoryScore,
    brand: brandScore,
    variant: variantScore,
    barcode: barcodeScore,
    stock: stockScore,
    price: priceScore,
    image: imageScore,
    content: contentScore,
    integrity: integrityScore,
    details,
  };
}

function getStatus(score: number): QualityDetail['status'] {
  if (score >= 90) return 'perfect';
  if (score >= 70) return 'good';
  if (score >= 50) return 'warning';
  return 'error';
}

// ==================== ANALIZ FONKSIYONLARI ====================

function analyzeCategory(product: XmlV2Product): number {
  const cats = [product.category, product.mainCategory, product.topCategory, product.subCategory]
    .filter(Boolean);
  if (cats.length === 0) return 0;
  if (cats.length >= 2) return 100;
  return 60;
}

function analyzeBrand(product: XmlV2Product): number {
  if (!product.brand) return 0;
  if (product.brand.length >= 2) return 100;
  return 40;
}

function analyzeVariant(product: XmlV2Product): number {
  if (product.variants && product.variants.length > 0) return 100;
  // Varyant yok - bu otomatik sorun degil
  // VariantEngineV2 karar verecek
  return 80;
}

function analyzeBarcode(product: XmlV2Product): number {
  if (!product.barcode) return 0;
  const cleaned = product.barcode.replace(/\s/g, '');
  if (cleaned.length >= 8 && cleaned.length <= 14) return 100;
  if (cleaned.length >= 6) return 50;
  return 20;
}

function analyzeStock(product: XmlV2Product): number {
  if (product.stock < 0) return 0;
  if (product.stock === 0) return 30;
  if (product.stock >= product.minStock) return 100;
  return 70;
}

function analyzePrice(product: XmlV2Product): number {
  if (product.price === null || product.price === undefined) {
    if (product.listPrice !== null) return 50;
    return 0;
  }
  if (product.price <= 0) return 0;
  if (product.listPrice && product.price > product.listPrice) return 50;
  if (product.price < 1) return 30;
  return 100;
}

function analyzeImage(product: XmlV2Product): number {
  if (!product.images) return 0;
  const urls = product.images.split(',').filter(u => u.trim().startsWith('http'));
  if (urls.length >= 3) return 100;
  if (urls.length >= 1) return 70;
  return 0;
}

function analyzeContent(product: XmlV2Product): number {
  let score = 100;
  if (!product.title || product.title.length < 5) score -= 30;
  if (!product.description || product.description.length < 20) score -= 20;
  if (product.title && product.title.length > 150) score -= 10;
  if (product.description && product.description.length > 5000) score -= 10;
  return Math.max(0, score);
}

function analyzeIntegrity(product: XmlV2Product): number {
  let issues = 0;
  if (product.price !== null && product.price <= 0) issues++;
  if (product.stock < 0) issues++;
  if (product.barcode && product.barcode.length < 6) issues++;
  if (product.price !== null && product.listPrice !== null && product.price > product.listPrice) issues++;
  return Math.max(0, 100 - issues * 25);
}

/**
 * XML kalite raporu olusturur
 */
export async function generateXmlQualityReport(
  sourceId: string
): Promise<XmlQualityReport | null> {
  const source = await prisma.xmlSource.findUnique({
    where: { id: sourceId },
    select: { id: true, name: true, sourceType: true, _count: { select: { products: true } } },
  });

  if (!source) return null;

  const products = await prisma.product.findMany({
    where: { xmlSourceId: sourceId },
    select: {
      xmlKey: true,
      title: true,
      sku: true,
      barcode: true,
      stock: true,
      minStock: true,
      salePrice: true,
      purchasePrice: true,
      images: true,
      description: true,
      category: { select: { name: true } },
      brand: { select: { name: true } },
    },
    take: 10000, // Ilk 10K
  });

  const productScores: XmlQualityReport['productScores'] = [];
  let perfect = 0, good = 0, warning = 0, error = 0;

  for (const p of products) {
    const xmlv2Product: XmlV2Product = {
      xmlKey: p.xmlKey,
      title: p.title,
      sku: p.sku || p.xmlKey,
      barcode: p.barcode,
      stock: p.stock,
      minStock: p.minStock,
      price: p.salePrice,
      listPrice: p.purchasePrice,
      tax: null,
      currency: null,
      brand: p.brand?.name || null,
      category: p.category?.name || null,
      mainCategory: null,
      topCategory: null,
      subCategory: null,
      description: p.description,
      detail: null,
      images: p.images,
      link: null,
      unit: null,
      active: true,
    };

    const score = calculateProductScore(xmlv2Product);
    const trustScore = score.overall;

    if (trustScore >= 90) perfect++;
    else if (trustScore >= 70) good++;
    else if (trustScore >= 50) warning++;
    else error++;

    const issues: string[] = [];
    const warnings: string[] = [];

    for (const d of score.details) {
      if (d.status === 'error') issues.push(`${d.field}: ${d.message}`);
      else if (d.status === 'warning') warnings.push(`${d.field}: ${d.message}`);
    }

    productScores.push({
      xmlKey: p.xmlKey,
      title: p.title,
      trustScore,
      variantDecision: null,
      issues,
      warnings,
    });
  }

  const total = products.length;
  const readinessRate = total > 0 ? Math.round(((perfect + good) / total) * 100) : 0;

  const overallScore = calculateProductScore({
    xmlKey: '',
    title: null,
    sku: '',
    barcode: null,
    stock: 0,
    minStock: 0,
    price: null,
    listPrice: null,
    tax: null,
    currency: null,
    brand: null,
    category: null,
    mainCategory: null,
    topCategory: null,
    subCategory: null,
    description: null,
    detail: null,
    images: null,
    link: null,
    unit: null,
    active: true,
  });

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: (source.sourceType as any) || 'xml',
    totalProducts: total,
    overallScore,
    productScores,
    summary: {
      perfect,
      good,
      warning,
      error,
      readinessRate,
    },
    analyzedAt: new Date(),
  };
}
