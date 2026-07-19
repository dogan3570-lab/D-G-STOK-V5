// ==================== COPILOT INTENT MATCHER V1 ====================
// Doğal dildeki kullanıcı isteğini anlar, intent/module/action eşleştirir
// Yeni iş mantığı yok, sadece NLP eşleştirme
// ===================================================================

import type { IntentMatch, IntentType, ModuleName } from './types.ts';

interface IntentPattern {
  keywords: string[];
  intent: IntentType;
  module: ModuleName;
  action: string;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // === WORKFLOW ===
  { keywords: ['hazır değil', 'hazır olmayan', 'eksik ürün'], intent: 'ANALYZE', module: 'workflow', action: 'findNotReady' },
  { keywords: ['workflow', 'durum'], intent: 'STATUS', module: 'workflow', action: 'getStatus' },
  { keywords: ['bloke', 'engelli', 'takılı'], intent: 'ANALYZE', module: 'workflow', action: 'findBlocked' },

  // === CATEGORY ===
  { keywords: ['kategori eksik', 'kategori sorun', 'kategorisiz'], intent: 'ANALYZE', module: 'category', action: 'findMissingCategory' },
  { keywords: ['kategori düzelt', 'kategori çöz'], intent: 'EXECUTE', module: 'category', action: 'fixCategory' },

  // === BRAND ===
  { keywords: ['marka eksik', 'marka sorun', 'markasız'], intent: 'ANALYZE', module: 'brand', action: 'findMissingBrand' },
  { keywords: ['marka düzelt', 'marka çöz'], intent: 'EXECUTE', module: 'brand', action: 'fixBrand' },

  // === VARIANT ===
  { keywords: ['varyant eksik', 'varyant sorun'], intent: 'ANALYZE', module: 'variant', action: 'findMissingVariant' },

  // === READY TO SEND ===
  { keywords: ['gönderime hazır', 'gönderilebilir'], intent: 'STATUS', module: 'readyToSend', action: 'getReadyCount' },

  // === AI IMAGE ===
  { keywords: ['görsel sorun', 'görsel problemi', 'görsel kalite', 'filigran', 'beyaz fon'], intent: 'ANALYZE', module: 'aiImage', action: 'findIssues' },

  // === AI SALES ===
  { keywords: ['kar düşük', 'karı düşük', 'karlılık'], intent: 'ANALYZE', module: 'aiSales', action: 'findLowProfit' },
  { keywords: ['fiyat artır', 'fiyatı artırılabilir'], intent: 'SUGGEST', module: 'aiSales', action: 'suggestPriceUp' },
  { keywords: ['fiyat düşür', 'fiyatı düşürülebilir'], intent: 'SUGGEST', module: 'aiSales', action: 'suggestPriceDown' },
  { keywords: ['kampanya', 'indirim'], intent: 'SUGGEST', module: 'aiSales', action: 'suggestCampaign' },

  // === ORDERS ===
  { keywords: ['sipariş', 'satış'], intent: 'ANALYZE', module: 'orders', action: 'analyzeOrders' },
  { keywords: ['en çok satan', 'popüler'], intent: 'REPORT', module: 'orders', action: 'topSelling' },

  // === MARKETPLACE ===
  { keywords: ['trendyol', 'hepsiburada', 'n11', 'amazon', 'pazarama'], intent: 'ANALYZE', module: 'marketplace', action: 'analyzeMarketplace' },
  { keywords: ['optimize et', 'iyileştir'], intent: 'SUGGEST', module: 'marketplace', action: 'optimize' },

  // === STOCK ===
  { keywords: ['stok risk', 'stok az', 'stok tüken'], intent: 'ANALYZE', module: 'stockProtection', action: 'findRisky' },

  // === AI COMMAND CENTER ===
  { keywords: ['ai command', 'sorun', 'hata'], intent: 'STATUS', module: 'aiCommandCenter', action: 'getIssues' },

  // === DASHBOARD ===
  { keywords: ['genel durum', 'özet', 'dashboard'], intent: 'REPORT', module: 'dashboard', action: 'summary' },
  { keywords: ['bugün satış', 'bugünkü'], intent: 'REPORT', module: 'orders', action: 'todaySummary' },
];

export class CopilotIntentMatcher {
  /**
   * Kullanıcı sorusunu analiz et, intent/module/action eşleştir
   */
  match(question: string): IntentMatch {
    const lower = question.toLowerCase();

    // En yüksek keyword eşleşmesini bul
    let bestMatch: IntentPattern | null = null;
    let bestScore = 0;

    for (const pattern of INTENT_PATTERNS) {
      const score = pattern.keywords.reduce((sum, kw) => {
        return sum + (lower.includes(kw) ? 1 : 0);
      }, 0);

      // Doğrudan modül adı eşleşmesi bonus
      const moduleName = pattern.module.toLowerCase();
      if (lower.includes(moduleName.replace(/([A-Z])/g, ' $1').trim())) {
        // camelCase modül adını boşluklu hale getir
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    if (bestMatch && bestScore > 0) {
      return {
        intent: bestMatch.intent,
        module: bestMatch.module,
        confidence: Math.min(100, Math.round((bestScore / 3) * 100)),
        action: bestMatch.action,
        params: { question: lower },
        originalQuestion: question,
      };
    }

    // Varsayılan: analiz et
    return {
      intent: 'ANALYZE',
      module: 'dashboard',
      confidence: 30,
      action: 'summary',
      params: { question: lower },
      originalQuestion: question,
    };
  }

  /**
   * Kullanıcıya önerilecek sorular
   */
  getSuggestions(): string[] {
    return [
      'Hazır olmayan ürünleri göster',
      'Kategori eksik ürünleri bul',
      'Görsel problemi olanları göster',
      'Trendyol\'u analiz et',
      'Bugün satışlar nasıl?',
      'Karı düşük ürünleri göster',
      'Fiyatı artırılabilecek ürünleri bul',
      'Varyantı eksik ürünleri göster',
      'Stok riski olan ürünleri göster',
      'Siparişleri analiz et',
      'En çok satan ürünler',
      'Kampanyaya uygun ürünler',
    ];
  }
}
