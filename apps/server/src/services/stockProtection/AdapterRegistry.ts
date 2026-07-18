// ==================== ADAPTER REGISTRY V1.0 ====================
// Her pazaryeri için doğru adapter'ı döndürür.
// MarketplaceAdapter interface'i üzerinden StockProtectionEngine'e hizmet eder.
// ================================================================

import { MarketplaceAdapter, DefaultMarketplaceAdapter } from './MarketplaceAdapter.ts';
import { TrendyolAdapter } from './TrendyolAdapter.ts';
import { HepsiburadaAdapter } from './HepsiburadaAdapter.ts';
import { N11Adapter } from './N11Adapter.ts';
import { AmazonAdapter } from './AmazonAdapter.ts';
import { PazaramaAdapter } from './PazaramaAdapter.ts';

type AdapterConstructor = new () => MarketplaceAdapter;

const ADAPTER_MAP: Record<string, AdapterConstructor> = {
  'trendyol': TrendyolAdapter,
  'tt': TrendyolAdapter,
  'hepsiburada': HepsiburadaAdapter,
  'he': HepsiburadaAdapter,
  'n11': N11Adapter,
  'amazon': AmazonAdapter,
  'amazontr': AmazonAdapter,
  'pazarama': PazaramaAdapter,
};

const adapterCache = new Map<string, MarketplaceAdapter>();
const defaultAdapter = new DefaultMarketplaceAdapter();

/**
 * Bir pazaryeri key'i için uygun MarketplaceAdapter döndürür.
 * Örnek: getAdapter('trendyol') → TrendyolAdapter instance
 *         getAdapter('bilinmeyen') → DefaultMarketplaceAdapter (log-only)
 */
export function getAdapter(marketplaceKey: string): MarketplaceAdapter {
  const key = marketplaceKey.toLowerCase().trim();

  // Cache'de varsa döndür
  const cached = adapterCache.get(key);
  if (cached) return cached;

  // Uygun adapter sınıfını bul
  const AdapterClass = ADAPTER_MAP[key];
  if (AdapterClass) {
    const instance = new AdapterClass();
    adapterCache.set(key, instance);
    return instance;
  }

  // Bilinmeyen pazaryeri → DefaultAdapter (log-only, API çağrısı yapmaz)
  return defaultAdapter;
}

/**
 * Tüm kayıtlı adapter'ların listesini döndürür.
 */
export function getRegisteredAdapters(): string[] {
  return Object.keys(ADAPTER_MAP);
}

/**
 * Adapter cache'ini temizler (test için).
 */
export function clearAdapterCache(): void {
  adapterCache.clear();
}
