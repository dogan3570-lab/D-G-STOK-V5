// ==================== AI VARIANT ENGINE V1 ====================
// DG STOK V5.0 - Ürün adından varyant çıkarma
// Variant V5 ile entegre, onu kullanır, yeniden yazmaz
// ==============================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';

const VARIANT_PATTERNS = [
  { regex: /\b(\d{2,3})\s*(numara|no)\b/i, type: 'NUMARA', label: 'Numara' },
  { regex: /\b(x[slm]|xx[sl]|xxxl?)\b/i, type: 'BEDEN', label: 'Beden' },
  { regex: /\b(s|m|l|xl|xxl)\b/i, type: 'BEDEN', label: 'Beden' },
  { regex: /\b(beyaz|siyah|kırmızı|mavi|yeşil|sarı|turuncu|mor|pembe|gri|bej|kahverengi|bordo|krem|lacivert|fuşya)\b/i, type: 'RENK', label: 'Renk' },
  { regex: /\b(\d+)\s*(kg|lt|ml|cl|gr|cm|mt|adet)\b/i, type: 'BOYUT', label: 'Boyut' },
  { regex: /\b(\d+)\s*(cm|m)\b/i, type: 'UZUNLUK', label: 'Uzunluk' },
];

export async function suggestVariants(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true },
  });
  if (!product) return null;

  const title = product.title || product.xmlKey || '';
  const suggestions: Array<{ type: string; currentValue: string | null; suggestedValue: string; confidence: number; reason: string }> = [];

  for (const pattern of VARIANT_PATTERNS) {
    const match = title.match(pattern.regex);
    if (match) {
      const existingVariant = product.variants?.find(
        v => v.name.toLowerCase() === pattern.label.toLowerCase()
      );
      
      if (!existingVariant) {
        suggestions.push({
          type: pattern.type,
          currentValue: null,
          suggestedValue: match[1] || match[0],
          confidence: 85,
          reason: `Ürün isminde "${match[0]}" bulundu (${pattern.label})`,
        });
      }
    }
  }

  // Kaydet
  for (const s of suggestions) {
    await prisma.aIVariantSuggestion.create({
      data: {
        productId,
        variantType: s.type,
        currentValue: s.currentValue,
        suggestedValue: s.suggestedValue,
        confidence: s.confidence,
        reason: s.reason,
      },
    });
  }

  return { productId, suggestions, total: suggestions.length };
}

export async function scanAllVariants(onProgress?: (d: number, t: number) => void) {
  const products = await prisma.product.findMany({ select: { id: true }, take: 10000 });
  const results = [];
  for (let i = 0; i < products.length; i += 500) {
    const batch = products.slice(i, i + 500);
    const r = await Promise.all(batch.map(p => suggestVariants(p.id)));
    results.push(...r.filter(Boolean));
    if (onProgress) onProgress(Math.min(i + 500, products.length), products.length);
  }
  return { total: products.length, processed: results.length };
}

export async function approveVariant(suggestionId: string) {
  const s = await prisma.aIVariantSuggestion.findUnique({ where: { id: suggestionId } });
  if (!s) return null;
  await prisma.aIVariantSuggestion.update({ where: { id: suggestionId }, data: { approved: true, approvedAt: new Date() } });
  EventBus.emit({ type: 'DashboardRefresh', correlationId: createCorrelationId('API'), timestamp: new Date().toISOString(), source: 'AIVariantEngine', data: { reason: 'variant_suggestion_approved', affectedProductIds: [s.productId] } });
  return { ok: true, productId: s.productId };
}

export async function rejectVariant(suggestionId: string) {
  await prisma.aIVariantSuggestion.update({ where: { id: suggestionId }, data: { approved: false } });
  return { ok: true };
}
