// ==================== AI KATEGORİ MOTORU V1 ====================
// DG STOK V5.0 - AI destekli kategori öneri motoru
// ===============================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';

const CATEGORY_RULES: Array<{ keywords: string[]; category: string; path: string }> = [
  { keywords: ['sneaker', 'spor ayakkabı', 'koşu'], category: 'Sneaker', path: 'Ayakkabı > Erkek > Sneaker' },
  { keywords: ['elbise', 'maxi', 'mini'], category: 'Elbise', path: 'Giyim > Kadın > Elbise' },
  { keywords: ['pantolon', 'jeans', 'kot'], category: 'Pantolon', path: 'Giyim > Erkek > Pantolon' },
  { keywords: ['telefon', 'iphone', 'samsung'], category: 'Cep Telefonu', path: 'Elektronik > Cep Telefonu' },
  { keywords: ['bilgisayar', 'laptop', 'notebook'], category: 'Bilgisayar', path: 'Elektronik > Bilgisayar' },
  { keywords: ['kitap', 'roman', 'hikaye'], category: 'Kitap', path: 'Kitap > Edebiyat' },
  { keywords: ['oyuncak', 'puzzle', 'lego'], category: 'Oyuncak', path: 'Oyuncak > Puzzle' },
  { keywords: ['ayakkabı', 'bot', 'çizme'], category: 'Ayakkabı', path: 'Ayakkabı > Bot' },
  { keywords: ['çanta', 'sırt çantası'], category: 'Çanta', path: 'Aksesuar > Çanta' },
  { keywords: ['saat', 'kol saati'], category: 'Saat', path: 'Aksesuar > Saat' },
  { keywords: ['gözlük', 'güneş gözlüğü'], category: 'Gözlük', path: 'Aksesuar > Gözlük' },
  { keywords: ['televizyon', 'tv', 'led'], category: 'Televizyon', path: 'Elektronik > Televizyon' },
  { keywords: ['tablet', 'ipad'], category: 'Tablet', path: 'Elektronik > Tablet' },
  { keywords: ['kulaklık', 'headset'], category: 'Kulaklık', path: 'Elektronik > Kulaklık' },
  { keywords: ['parfüm', 'deodorant'], category: 'Parfüm', path: 'Kozmetik > Parfüm' },
  { keywords: ['bebek bezi', 'mama'], category: 'Bebek Bezi', path: 'Bebek > Bez & Islak Mendil' },
  { keywords: ['oyun', 'ps5', 'xbox'], category: 'Oyun', path: 'Elektronik > Oyun Konsolu' },
];

const MARKETPLACES = [
  { key: 'trendyol', name: 'Trendyol' },
  { key: 'hepsiburada', name: 'Hepsiburada' },
  { key: 'n11', name: 'N11' },
  { key: 'amazon', name: 'Amazon' },
  { key: 'ciceksepeti', name: 'ÇiçekSepeti' },
  { key: 'pazarama', name: 'Pazarama' },
];

function analyzeProductName(title: string): { category: string; path: string; confidence: number; reason: string } {
  const lower = title.toLowerCase();
  
  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
        const confidence = Math.min(98, 80 + Math.round((keyword.length / title.length) * 20));
        return {
          category: rule.category,
          path: rule.path,
          confidence,
          reason: `Ürün isminde "${keyword}" geçti`,
        };
      }
    }
  }

  return {
    category: 'Diğer',
    path: 'Genel > Diğer',
    confidence: 50,
    reason: 'Kategori belirlenemedi, manuel inceleme gerekli',
  };
}

export async function suggestCategory(productId: string, marketplaceKey = 'trendyol') {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true, xmlSource: true },
  });

  if (!product) return null;

  const analysis = analyzeProductName(product.title || product.xmlKey);
  const currentCategory = product.category?.name || null;
  const currentCategoryId = product.categoryId;

  // Kaydet
  const suggestion = await prisma.aICategorySuggestion.upsert({
    where: { id: `${productId}_${marketplaceKey}` },
    update: {
      suggestedCategory: analysis.path,
      confidence: analysis.confidence,
      reason: analysis.reason,
      marketplace: marketplaceKey,
    },
    create: {
      productId,
      marketplace: marketplaceKey,
      currentCategory,
      currentCategoryId,
      suggestedCategory: analysis.path,
      suggestedCategoryId: null,
      confidence: analysis.confidence,
      reason: analysis.reason,
    },
  });

  return {
    productId,
    marketplace: marketplaceKey,
    currentCategory,
    currentCategoryId,
    suggestedCategory: analysis.path,
    suggestedCategoryId: null,
    confidence: analysis.confidence,
    reason: analysis.reason,
  };
}

export async function scanAllCategories(onProgress?: (done: number, total: number) => void) {
  const products = await prisma.product.findMany({ select: { id: true }, take: 10000 });
  const total = products.length;
  const results = [];

  for (let i = 0; i < products.length; i += 500) {
    const batch = products.slice(i, i + 500);
    const batchResults = await Promise.all(
      batch.map(p => suggestCategory(p.id, 'trendyol'))
    );
    results.push(...batchResults.filter(Boolean));
    if (onProgress) onProgress(Math.min(i + 500, total), total);
  }

  return { total, processed: results.length };
}

export async function approveSuggestion(suggestionId: string) {
  const suggestion = await prisma.aICategorySuggestion.findUnique({ where: { id: suggestionId } });
  if (!suggestion) return null;

  // Onayla
  await prisma.aICategorySuggestion.update({
    where: { id: suggestionId },
    data: { approved: true, approvedAt: new Date() },
  });

  // EventBus
  EventBus.emit({
    type: 'DashboardRefresh',
    correlationId: createCorrelationId('API'),
    timestamp: new Date().toISOString(),
    source: 'AICategoryEngine',
    data: { reason: 'category_suggestion_approved', affectedProductIds: [suggestion.productId] },
  });

  return { ok: true, productId: suggestion.productId, suggestedCategory: suggestion.suggestedCategory };
}

export async function rejectSuggestion(suggestionId: string) {
  await prisma.aICategorySuggestion.update({
    where: { id: suggestionId },
    data: { approved: false },
  });
  return { ok: true };
}
