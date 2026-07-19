// ==================== AI CONTENT & SEO ENGINE V1 ====================
// DG STOK V5.0 - Başlık, açıklama, SEO, yasaklı kelime analizi
// ====================================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';

const FORBIDDEN_WORDS = ['orijinal', 'birebir', 'en ucuz', 'garantili kazanç', 'ücretsiz kargo', 'kaliteli', 'birinci sınıf', 'muadil', 'orijinal kalite'];

const MARKETPLACE_TITLE_RULES: Record<string, { maxLength: number; pattern: string }> = {
  trendyol: { maxLength: 100, pattern: 'Marka + Model + Cinsiyet + Ürün Tipi + Renk + Numara' },
  hepsiburada: { maxLength: 120, pattern: 'Marka + Model + Ürün Tipi + Renk + Beden' },
  n11: { maxLength: 100, pattern: 'Marka + Model + Ürün Tipi + Renk + Numara' },
  amazon: { maxLength: 200, pattern: 'Marka + Model + Ürün Tipi + Renk + Boyut + Paket' },
};

export async function analyzeContent(productId: string, marketplaceKey = 'trendyol') {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, category: true },
  });
  if (!product) return null;

  const title = product.title || product.xmlKey || '';
  const brand = product.brand?.name || '';
  const desc = product.description || '';

  // Başlık optimizasyonu
  const suggestedTitle = [brand, title].filter(Boolean).join(' ');
  const titleScore = suggestedTitle.length > 20 && suggestedTitle.length <= 100 ? 100 : suggestedTitle.length > 100 ? 70 : 30;

  // Açıklama
  const suggestedDesc = desc.length > 100 ? desc : `${title}\n\nÜrün Özellikleri:\n- Marka: ${brand || 'Belirtilmemiş'}\n- Kategori: ${product.category?.name || 'Belirtilmemiş'}\n\n${desc}`;
  const descScore = suggestedDesc.length > 200 ? 100 : suggestedDesc.length > 100 ? 70 : 30;

  // SEO skoru
  const hasKeywords = title.length > 30;
  const hasDescription = desc.length > 50;
  const seoScore = (hasKeywords ? 50 : 0) + (hasDescription ? 50 : 0);

  // Yasaklı kelimeler
  const lowerTitle = title.toLowerCase();
  const lowerDesc = desc.toLowerCase();
  const foundForbidden = FORBIDDEN_WORDS.filter(w => lowerTitle.includes(w) || lowerDesc.includes(w));

  // Anahtar kelimeler
  const stopWords = ['ve', 'veya', 'ile', 'bir', 'bu', 'şu', 'o', 'için', 'en', 'çok'];
  const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
  const keywords = [...new Set(words)].slice(0, 10);

  const overallScore = Math.round((titleScore + descScore + seoScore) / 3);
  const confidence = overallScore >= 80 ? 90 : overallScore >= 60 ? 75 : 50;

  await prisma.aIContentSuggestion.upsert({
    where: { id: `${productId}_${marketplaceKey}` },
    update: {
      suggestedTitle, suggestedDescription: suggestedDesc,
      keywords: JSON.stringify(keywords), forbiddenWords: JSON.stringify(foundForbidden),
      titleScore, descriptionScore: descScore, seoScore,
      overallScore, confidence, marketplace: marketplaceKey,
    },
    create: {
      productId, marketplace: marketplaceKey,
      currentTitle: title, suggestedTitle,
      currentDescription: desc, suggestedDescription: suggestedDesc,
      keywords: JSON.stringify(keywords), forbiddenWords: JSON.stringify(foundForbidden),
      titleScore, descriptionScore: descScore, seoScore,
      overallScore, confidence,
    },
  });

  return {
    productId, marketplace: marketplaceKey,
    title: { current: title, suggested: suggestedTitle, score: titleScore },
    description: { current: desc, suggested: suggestedDesc, score: descScore },
    keywords, forbiddenWords: foundForbidden,
    seoScore, overallScore, confidence,
  };
}

export async function scanAllContent(onProgress?: (d: number, t: number) => void) {
  const products = await prisma.product.findMany({ select: { id: true }, take: 10000 });
  const results = [];
  for (let i = 0; i < products.length; i += 500) {
    const batch = products.slice(i, i + 500);
    const r = await Promise.all(batch.map(p => analyzeContent(p.id)));
    results.push(...r.filter(Boolean));
    if (onProgress) onProgress(Math.min(i + 500, products.length), products.length);
  }
  return { total: products.length, processed: results.length };
}

export async function approveContent(suggestionId: string) {
  const s = await prisma.aIContentSuggestion.findUnique({ where: { id: suggestionId } });
  if (!s) return null;
  await prisma.aIContentSuggestion.update({ where: { id: suggestionId }, data: { approved: true, approvedAt: new Date() } });
  EventBus.emit({ type: 'DashboardRefresh', correlationId: createCorrelationId('API'), timestamp: new Date().toISOString(), source: 'AIContentEngine', data: { reason: 'content_suggestion_approved', affectedProductIds: [s.productId] } });
  return { ok: true, productId: s.productId };
}

export async function rejectContent(suggestionId: string) {
  await prisma.aIContentSuggestion.update({ where: { id: suggestionId }, data: { approved: false } });
  return { ok: true };
}
