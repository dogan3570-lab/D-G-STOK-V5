// ==================== MARKETPLACE ADAPTER INTERFACE V3 ====================
// Her pazaryeri bu interface'i implemente eder.
// Engine sadece "CLOSE/OPEN" kararı verir, NASIL kapatılacağına ADAPTER karar verir.
// V3: AdapterHealthScore eklendi - detaylı sağlık metrikleri
// ======================================================================

export interface MarketplaceAdapter {
  /** Ürünün satışını kapat (stok kritik seviyenin altında) 
   *  Her pazaryeri farklı strateji kullanır:
   *    Trendyol → stok=0 gönder
   *    Hepsiburada → listing pasif
   *    Amazon → quantity update
   *    N11 → stok güncelle
   */
  closeListing(marketplaceKey: string, productId: string, sku: string): Promise<AdapterResult>;
  
  /** Ürünün satışını aç (stok normale döndü) */
  openListing(marketplaceKey: string, productId: string, sku: string): Promise<AdapterResult>;
  
  /** Stok güncellemesi gönder */
  updateStock(marketplaceKey: string, productId: string, sku: string, stock: number): Promise<AdapterResult>;
  
  /** Bağlantı sağlık kontrolü */
  health(marketplaceKey: string): Promise<AdapterHealthResult>;

  /** Pazaryeri bazlı kritik stok seviyesini döndürür.
   *  null dönerse, engine globalCriticalStock kullanır. */
  getCriticalStockLevel(marketplaceKey: string): Promise<number | null>;

  /** V3: Detaylı sağlık puanı metrikleri
   *  Entegrasyon Merkezi'nde gösterilmek üzere adapter performans verileri */
  getHealthScore(marketplaceKey: string): Promise<AdapterHealthScore>;
}

export interface AdapterResult {
  success: boolean;
  message: string;
  marketplaceKey: string;
  durationMs: number;
  httpStatus?: number;
  apiResponse?: string;
  error?: string;
}

export interface AdapterHealthResult {
  healthy: boolean;
  marketplaceKey: string;
  latency: number;
  error?: string;
}

/** 
 * V3: Detaylı Sağlık Puanı
 * Her adapter bu metrikleri üretir, Entegrasyon Merkezi'nde gösterilir.
 */
export interface AdapterHealthScore {
  marketplaceKey: string;
  marketplaceName: string;
  healthy: boolean;
  /** Başarı yüzdesi (ör: 99.8) */
  successRate: number;
  /** Ortalama cevap süresi (ms) */
  averageLatency: number;
  /** Bugünkü toplam hata sayısı */
  todayErrors: number;
  /** Bugünkü toplam retry sayısı */
  totalRetries: number;
  /** HTTP 429 (Rate Limit) sayısı */
  http429: number;
  /** HTTP 401 (Unauthorized) sayısı */
  http401: number;
  /** HTTP 500 (Server Error) sayısı */
  http500: number;
  /** Diğer hatalar */
  otherErrors: number;
  /** Toplam istek sayısı */
  totalRequests: number;
  /** Son 24 saatteki başarı oranı */
  last24hSuccessRate: number;
  /** Son kontrol zamanı */
  lastCheckedAt: string;
}

// ==================== DEFAULT ADAPTER (Log only) ====================

export class DefaultMarketplaceAdapter implements MarketplaceAdapter {
  async closeListing(marketplaceKey: string, _productId: string, sku: string): Promise<AdapterResult> {
    const start = Date.now();
    console.log(`[StockProtection] ${marketplaceKey} listing CLOSED for SKU ${sku}`);
    return { success: true, message: `Listing closed on ${marketplaceKey}`, marketplaceKey, durationMs: Date.now() - start };
  }

  async openListing(marketplaceKey: string, _productId: string, sku: string): Promise<AdapterResult> {
    const start = Date.now();
    console.log(`[StockProtection] ${marketplaceKey} listing OPENED for SKU ${sku}`);
    return { success: true, message: `Listing opened on ${marketplaceKey}`, marketplaceKey, durationMs: Date.now() - start };
  }

  async updateStock(marketplaceKey: string, _productId: string, sku: string, stock: number): Promise<AdapterResult> {
    const start = Date.now();
    console.log(`[StockProtection] ${marketplaceKey} stock UPDATED for SKU ${sku}: ${stock}`);
    return { success: true, message: `Stock updated on ${marketplaceKey}`, marketplaceKey, durationMs: Date.now() - start };
  }

  async health(marketplaceKey: string): Promise<AdapterHealthResult> {
    return { healthy: true, marketplaceKey, latency: 0 };
  }

  async getCriticalStockLevel(_marketplaceKey: string): Promise<number | null> {
    return null; // null = engine globalCriticalStock kullansın
  }

  async getHealthScore(marketplaceKey: string): Promise<AdapterHealthScore> {
    return {
      marketplaceKey,
      marketplaceName: marketplaceKey,
      healthy: true,
      successRate: 100,
      averageLatency: 0,
      todayErrors: 0,
      totalRetries: 0,
      http429: 0,
      http401: 0,
      http500: 0,
      otherErrors: 0,
      totalRequests: 0,
      last24hSuccessRate: 100,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}
