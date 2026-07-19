// ==================== AI BRAND ENGINE V1 ====================
// DG STOK V5.0 - AI destekli marka öneri motoru
// =============================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';

const BRAND_DICTIONARY = [
  { names: ['nike', 'jordan'], brand: 'Nike' },
  { names: ['adidas', 'addidas'], brand: 'Adidas' },
  { names: ['puma'], brand: 'Puma' },
  { names: ['lc waikiki', 'l c waikiki'], brand: 'LC Waikiki' },
  { names: ['mavi'], brand: 'Mavi' },
  { names: ['koton'], brand: 'Koton' },
  { names: ['defacto', 'de facto'], brand: 'Defacto' },
  { names: ['columbia'], brand: 'Columbia' },
  { names: ['hugo boss', 'boss'], brand: 'Hugo Boss' },
  { names: ['zara'], brand: 'Zara' },
  { names: ['hm', 'h&m'], brand: 'H&M' },
  { names: ['apple', 'iphone', 'ipad', 'macbook'], brand: 'Apple' },
  { names: ['samsung', 'galaxy'], brand: 'Samsung' },
  { names: ['xiaomi', 'mi'], brand: 'Xiaomi' },
  { names: ['lg'], brand: 'LG' },
  { names: ['sony'], brand: 'Sony' },
  { names: ['philips'], brand: 'Philips' },
  { names: ['beko'], brand: 'Beko' },
  { names: ['arcelik'], brand: 'Arçelik' },
  { names: ['vestel'], brand: 'Vestel' },
];

export async function suggestBrand(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, xmlSource: true },
  });
  if (!product) return null;

  const title = (product.title || product.xmlKey).toLowerCase();
  let suggestedBrand = '';
  let confidence = 0;
  let reason = '';

  for (const entry of BRAND_DICTIONARY) {
    for (const name of entry.names) {
      if (title.includes(name)) {
        suggestedBrand = entry.brand;
        confidence = Math.min(95, 70 + Math.round((name.length / title.length) * 30));
        reason = `Ürün isminde "${name}" markası bulundu`;
        break;
      }
    }
    if (suggestedBrand) break;
  }

  if (!suggestedBrand) {
    suggestedBrand = 'DG STORE';
    confidence = 50;
    reason = 'Marka belirlenemedi, varsayılan marka önerildi';
  }

  await prisma.aIBrandSuggestion.upsert({
    where: { id: `${productId}_brand` },
    update: { currentBrand: product.brand?.name, suggestedBrand, confidence, reason },
    create: { productId, currentBrand: product.brand?.name, suggestedBrand, confidence, reason },
  });

  return { productId, currentBrand: product.brand?.name, suggestedBrand, confidence, reason };
}

export async function scanAllBrands(onProgress?: (d: number, t: number) => void) {
  const products = await prisma.product.findMany({ select: { id: true }, take: 10000 });
  const results = [];
  for (let i = 0; i < products.length; i += 500) {
    const batch = products.slice(i, i + 500);
    const r = await Promise.all(batch.map(p => suggestBrand(p.id)));
    results.push(...r.filter(Boolean));
    if (onProgress) onProgress(Math.min(i + 500, products.length), products.length);
  }
  return { total: products.length, processed: results.length };
}

export async function approveBrand(suggestionId: string) {
  const s = await prisma.aIBrandSuggestion.findUnique({ where: { id: suggestionId } });
  if (!s) return null;
  await prisma.aIBrandSuggestion.update({ where: { id: suggestionId }, data: { approved: true, approvedAt: new Date() } });
  EventBus.emit({ type: 'DashboardRefresh', correlationId: createCorrelationId('API'), timestamp: new Date().toISOString(), source: 'AIBrandEngine', data: { reason: 'brand_suggestion_approved', affectedProductIds: [s.productId] } });
  return { ok: true, productId: s.productId, suggestedBrand: s.suggestedBrand };
}

export async function rejectBrand(suggestionId: string) {
  await prisma.aIBrandSuggestion.update({ where: { id: suggestionId }, data: { approved: false } });
  return { ok: true };
}
