// ==================== FİYATLANDIRMA MOTORU V5.0 ====================
// DG STOK V5.0 - 10 Aşamalı Enterprise Fiyat Hesaplama
// Her adım ayrı loglanır, kullanıcı tüm süreci görebilir
// ===============================================================

import type { PriceRule } from './types.ts';

export interface PriceStep {
  step: number;
  name: string;
  before: number;
  after: number;
  formula: string;
}

export interface PriceCalculationV5 {
  purchasePrice: number;
  vatRate: number;
  vatIncludedPrice: number;
  costAfterExtra: number;
  costAfterCargo: number;
  costAfterCommission: number;
  priceAfterProfit: number;
  priceAfterFixedProfit: number;
  priceAfterDiscount: number;
  roundedPrice: number;
  finalPrice: number;
  steps: PriceStep[];
  profitMargin: number;
  fixedProfit: number;
  commissionRate: number;
  cargoShare: number;
  extraCost: number;
  discount: number;
  rounding: string;
  minPrice: number;
  maxPrice: number;
  rule: PriceRule | null;
  ruleType: string;
}

function applyRounding(price: number, rounding: string): number {
  switch (rounding) {
    case '0.90': return Math.floor(price) + 0.90;
    case '0.95': return Math.floor(price) + 0.95;
    case '0.99': return Math.floor(price) + 0.99;
    case '9.90': return Math.floor(price / 10) * 10 + 9.90;
    case '49.90': return Math.floor(price / 50) * 50 + 49.90;
    case '99.90': return Math.floor(price / 100) * 100 + 99.90;
    case 'nearest': return Math.round(price);
    case 'ceil': return Math.ceil(price);
    case 'floor': return Math.floor(price);
    case 'round5': return Math.round(price / 5) * 5;
    case 'round10': return Math.round(price / 10) * 10;
    default: return Math.round(price * 100) / 100;
  }
}

/**
 * 10 Aşamalı Enterprise Fiyat Hesaplama Motoru
 *
 * Sıra:
 *  1. XML Alış Fiyatı
 *  2. KDV uygula
 *  3. Ek maliyet ekle
 *  4. Kargo payı ekle
 *  5. Komisyon etkisini hesapla
 *  6. Kâr oranı uygula
 *  7. Sabit kâr ekle
 *  8. İndirim uygula
 *  9. Yuvarlama uygula
 * 10. Min/Max kontrolü → Nihai Satış Fiyatı
 */
export function calculatePriceV5(
  purchasePrice: number,
  vatRate: number,
  rule: PriceRule & {
    extraCost?: number;
    cargoShare?: number;
    commissionRate?: number;
    fixedProfit?: number;
    discount?: number;
    minPrice?: number;
    maxPrice?: number;
  }
): PriceCalculationV5 {
  const steps: PriceStep[] = [];
  let currentPrice = purchasePrice;

  // Varsayılan değerler
  const extraCost = rule.extraCost ?? 0;
  const cargoShare = rule.cargoShare ?? 0;
  const commissionRate = rule.commissionRate ?? 0;
  const profitMargin = rule.profitMargin ?? 0;
  const fixedProfit = rule.fixedProfit ?? 0;
  const discount = rule.discount ?? 0;
  const minPrice = rule.minPrice ?? 0;
  const maxPrice = rule.maxPrice ?? 999999;
  const applyVat = rule.applyVat !== false;

  // Adım 1: Başlangıç (XML Alış Fiyatı)
  steps.push({ step: 1, name: 'XML Alış Fiyatı', before: 0, after: currentPrice, formula: `Alış: ${currentPrice} TL` });

  // Adım 2: KDV uygula
  if (applyVat && vatRate > 0) {
    const before = currentPrice;
    currentPrice = currentPrice * (1 + vatRate / 100);
    currentPrice = Math.round(currentPrice * 100) / 100;
    steps.push({ step: 2, name: 'KDV Uygula', before, after: currentPrice, formula: `${before} × (1 + ${vatRate}%)` });
  } else {
    steps.push({ step: 2, name: 'KDV Uygula (Yok)', before: currentPrice, after: currentPrice, formula: 'KDV eklenmedi' });
  }

  // Adım 3: Ek maliyet ekle
  if (extraCost > 0) {
    const before = currentPrice;
    currentPrice = currentPrice + extraCost;
    steps.push({ step: 3, name: 'Ek Maliyet', before, after: currentPrice, formula: `${before} + ${extraCost} TL` });
  } else {
    steps.push({ step: 3, name: 'Ek Maliyet (Yok)', before: currentPrice, after: currentPrice, formula: 'Ek maliyet yok' });
  }

  // Adım 4: Kargo payı ekle
  if (cargoShare > 0) {
    const before = currentPrice;
    currentPrice = currentPrice + cargoShare;
    steps.push({ step: 4, name: 'Kargo Payı', before, after: currentPrice, formula: `${before} + ${cargoShare} TL` });
  } else {
    steps.push({ step: 4, name: 'Kargo Payı (Yok)', before: currentPrice, after: currentPrice, formula: 'Kargo payı yok' });
  }

  // Adım 5: Komisyon etkisini hesapla (komisyon + kâr aynı anda)
  // Komisyon dahil fiyat: hedef_fiyat = maliyet / (1 - komisyon%)
  if (commissionRate > 0) {
    const before = currentPrice;
    const commissionMultiplier = 1 - commissionRate / 100;
    if (commissionMultiplier > 0) {
      currentPrice = currentPrice / commissionMultiplier;
      currentPrice = Math.round(currentPrice * 100) / 100;
    }
    steps.push({ step: 5, name: 'Komisyon Etkisi', before, after: currentPrice, formula: `${before} / (1 - ${commissionRate}%)` });
  } else {
    steps.push({ step: 5, name: 'Komisyon (Yok)', before: currentPrice, after: currentPrice, formula: 'Komisyon yok' });
  }

  // Adım 6: Kâr oranı uygula
  if (profitMargin > 0) {
    const before = currentPrice;
    currentPrice = currentPrice * (1 + profitMargin / 100);
    currentPrice = Math.round(currentPrice * 100) / 100;
    steps.push({ step: 6, name: 'Kâr Oranı', before, after: currentPrice, formula: `${before} × (1 + ${profitMargin}%)` });
  } else {
    steps.push({ step: 6, name: 'Kâr Oranı (Yok)', before: currentPrice, after: currentPrice, formula: 'Kâr eklenmedi' });
  }

  // Adım 7: Sabit kâr ekle
  if (fixedProfit > 0) {
    const before = currentPrice;
    currentPrice = currentPrice + fixedProfit;
    steps.push({ step: 7, name: 'Sabit Kâr', before, after: currentPrice, formula: `${before} + ${fixedProfit} TL` });
  } else {
    steps.push({ step: 7, name: 'Sabit Kâr (Yok)', before: currentPrice, after: currentPrice, formula: 'Sabit kâr yok' });
  }

  // Adım 8: İndirim uygula
  if (discount > 0) {
    const before = currentPrice;
    currentPrice = currentPrice * (1 - discount / 100);
    currentPrice = Math.round(currentPrice * 100) / 100;
    steps.push({ step: 8, name: 'İndirim', before, after: currentPrice, formula: `${before} × (1 - ${discount}%)` });
  } else {
    steps.push({ step: 8, name: 'İndirim (Yok)', before: currentPrice, after: currentPrice, formula: 'İndirim yok' });
  }

  // Adım 9: Yuvarlama uygula
  const roundingType = rule.rounding || 'none';
  if (roundingType !== 'none') {
    const before = currentPrice;
    currentPrice = applyRounding(currentPrice, roundingType);
    steps.push({ step: 9, name: 'Yuvarlama', before, after: currentPrice, formula: `${before} → ${roundingType}` });
  } else {
    steps.push({ step: 9, name: 'Yuvarlama (Yok)', before: currentPrice, after: currentPrice, formula: 'Yuvarlama yok' });
  }

  // Adım 10: Min/Max kontrolü
  let minMaxChanged = false;
  if (currentPrice < minPrice) {
    currentPrice = minPrice;
    minMaxChanged = true;
  }
  if (currentPrice > maxPrice) {
    currentPrice = maxPrice;
    minMaxChanged = true;
  }
  if (minMaxChanged) {
    steps.push({ step: 10, name: 'Min/Max Kontrolü', before: steps[steps.length - 1].after, after: currentPrice, formula: `Min: ${minPrice}, Max: ${maxPrice}` });
  } else {
    steps.push({ step: 10, name: 'Min/Max Kontrolü', before: currentPrice, after: currentPrice, formula: 'Geçerli aralıkta' });
  }

  const finalPrice = Math.round(currentPrice * 100) / 100;

  return {
    purchasePrice,
    vatRate,
    vatIncludedPrice: steps[1]?.after || purchasePrice,
    costAfterExtra: steps[2]?.after || purchasePrice,
    costAfterCargo: steps[3]?.after || purchasePrice,
    costAfterCommission: steps[4]?.after || purchasePrice,
    priceAfterProfit: steps[5]?.after || purchasePrice,
    priceAfterFixedProfit: steps[6]?.after || purchasePrice,
    priceAfterDiscount: steps[7]?.after || purchasePrice,
    roundedPrice: steps[8]?.after || purchasePrice,
    finalPrice,
    steps,
    profitMargin,
    fixedProfit,
    commissionRate,
    cargoShare,
    extraCost,
    discount,
    rounding: roundingType,
    minPrice,
    maxPrice,
    rule: rule as any,
    ruleType: rule.ruleType || 'GENERAL',
  };
}

// Geriye uyumluluk için eski fonksiyon
export function calculatePrice(
  purchasePrice: number,
  vatRate: number,
  rule: PriceRule
) {
  const result = calculatePriceV5(purchasePrice, vatRate, rule as any);
  return {
    purchasePrice: result.purchasePrice,
    vatRate: result.vatRate,
    vatIncludedPrice: result.vatIncludedPrice,
    profitMargin: result.profitMargin,
    calculatedPrice: result.priceAfterProfit,
    roundedPrice: result.finalPrice,
    rounding: result.rounding,
    rule: result.rule,
    ruleType: result.ruleType,
  };
}

// Basit önizleme (10 aşamalı)
// Geriye uyumluluk için eski previewPrice
export function previewPrice(
  purchasePrice: number,
  vatRate: number,
  profitMargin: number,
  rounding: string,
  applyVat: boolean
): { vatIncluded: number; beforeRounding: number; finalPrice: number } {
  const result = previewPriceV5(purchasePrice, vatRate, profitMargin, rounding, applyVat);
  return {
    vatIncluded: result.vatIncludedPrice,
    beforeRounding: result.priceAfterProfit,
    finalPrice: result.finalPrice,
  };
}

export function previewPriceV5(
  purchasePrice: number,
  vatRate: number,
  profitMargin: number,
  rounding: string,
  applyVat: boolean,
  extraOptions?: {
    extraCost?: number;
    cargoShare?: number;
    commissionRate?: number;
    fixedProfit?: number;
    discount?: number;
    minPrice?: number;
    maxPrice?: number;
  }
): PriceCalculationV5 {
  return calculatePriceV5(purchasePrice, vatRate, {
    profitMargin,
    rounding: rounding || 'none',
    applyVat,
    id: 'preview',
    marketplaceId: 'preview',
    minPrice: 0,
    maxPrice: 999999,
    active: true,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extraOptions,
  });
}
