// ==================== MARKETPLACE SDK - ADAPTER INTERFACE V1.0 ====================
// Bütün pazaryerleri bu interface'i implemente eder.
// Trendyol, Hepsiburada, N11, Pazarama, Amazon, ÇiçekSepeti, İkas, WooCommerce
// ================================================================================

import { CorrelationId } from '../../eventBus/events.ts';
import { MarketplaceClient } from './MarketplaceClient.ts';
import { MarketplaceResponse } from './MarketplaceResponse.ts';
import {
  MarketplaceConfig,
  MarketplaceProduct,
  MarketplaceOrder,
  MarketplaceShipment,
  MarketplaceCategory,
  MarketplaceBrand,
  MarketplaceHealthMetrics,
  ConnectionStatus,
} from './MarketplaceTypes.ts';

/**
 * Tüm pazaryeri adapter'larının implemente etmesi gereken interface.
 * Her pazaryeri kendi klasöründe bu interface'i implemente eder.
 * 
 * Örnek:
 * ```
 * apps/server/src/services/marketplaces/trendyol/TrendyolAdapter.ts
 * apps/server/src/services/marketplaces/hepsiburada/HepsiburadaAdapter.ts
 * ```
 */
export interface IMarketplaceAdapter {
  /** Pazaryeri anahtarı (trendyol, hepsiburada, n11, ...) */
  readonly key: string;
  /** Pazaryeri görünen adı */
  readonly name: string;

  // ==================== YAŞAM DÖNGÜSÜ ====================

  /** Adapter'ı başlat (client oluştur, bağlantı kur) */
  connect(): Promise<MarketplaceResponse<void>>;

  /** Bağlantı sağlık kontrolü */
  health(): Promise<MarketplaceResponse<MarketplaceHealthMetrics>>;

  /** Bağlantıyı test et (credentials doğrulama) */
  testConnection(): Promise<MarketplaceResponse<boolean>>;

  // ==================== ÜRÜN YÖNETİMİ ====================

  /** Yeni ürün gönder */
  createProduct(product: MarketplaceProduct): Promise<MarketplaceResponse<{ listingId: string }>>;

  /** Ürün güncelle */
  updateProduct(product: MarketplaceProduct): Promise<MarketplaceResponse<void>>;

  /** Ürün sil */
  deleteProduct(sku: string): Promise<MarketplaceResponse<void>>;

  // ==================== STOK & FİYAT ====================

  /** Stok güncelle */
  updateStock(sku: string, quantity: number): Promise<MarketplaceResponse<void>>;

  /** Fiyat güncelle */
  updatePrice(sku: string, price: number, currency?: string): Promise<MarketplaceResponse<void>>;

  // ==================== SİPARİŞ YÖNETİMİ ====================

  /** Siparişleri getir */
  getOrders(status?: string, page?: number, pageSize?: number): Promise<MarketplaceResponse<MarketplaceOrder[]>>;

  /** Sipariş durumu güncelle */
  updateOrder(orderNo: string, status: string): Promise<MarketplaceResponse<void>>;

  // ==================== KARGO & İADE ====================

  /** Kargo bilgisi gönder */
  createShipment(shipment: MarketplaceShipment): Promise<MarketplaceResponse<void>>;

  /** Sipariş iptal et */
  cancelOrder(orderNo: string, reason?: string): Promise<MarketplaceResponse<void>>;

  // ==================== KATEGORİ & MARKA ====================

  /** Kategorileri getir */
  getCategories(): Promise<MarketplaceResponse<MarketplaceCategory[]>>;

  /** Markaları getir */
  getBrands(): Promise<MarketplaceResponse<MarketplaceBrand[]>>;

  // ==================== DOĞRULAMA ====================

  /** Ürün verilerini doğrula (göndermeden önce) */
  validate(product: MarketplaceProduct): Promise<MarketplaceResponse<{ valid: boolean; errors: string[] }>>;

  // ==================== ADAPTER BİLGİSİ ====================

  /** Adapter yapılandırmasını getir */
  getConfig(): MarketplaceConfig;

  /** HTTP client'ı getir (alt seviye erişim için) */
  getClient(): MarketplaceClient;
}

/**
 * Temel adapter sınıfı.
 * Tüm pazaryeri adapter'ları bu sınıfı extend eder.
 * Ortak işlemleri (bağlantı, client, log) burada yapılır.
 */
export abstract class BaseMarketplaceAdapter implements IMarketplaceAdapter {
  public abstract readonly key: string;
  public abstract readonly name: string;

  protected config: MarketplaceConfig;
  protected client: MarketplaceClient;
  protected connectionStatus: ConnectionStatus = 'disconnected';

  constructor(config: MarketplaceConfig) {
    this.config = config;
    this.client = MarketplaceClient.getInstance(config);
  }

  // ==================== YAŞAM DÖNGÜSÜ ====================

  abstract connect(): Promise<MarketplaceResponse<void>>;

  abstract health(): Promise<MarketplaceResponse<MarketplaceHealthMetrics>>;

  async testConnection(): Promise<MarketplaceResponse<boolean>> {
    try {
      const healthResult = await this.health();
      return {
        success: healthResult.success,
        status: healthResult.status,
        data: healthResult.success,
        duration: healthResult.duration,
        correlationId: healthResult.correlationId,
        retryCount: healthResult.retryCount,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 0,
        data: false,
        error: { code: 'CONNECTION_ERROR', message: err.message, recoverable: true },
        duration: 0,
        correlationId: 'N/A',
        retryCount: 0,
      };
    }
  }

  // ==================== ÜRÜN YÖNETİMİ ====================

  abstract createProduct(product: MarketplaceProduct): Promise<MarketplaceResponse<{ listingId: string }>>;
  abstract updateProduct(product: MarketplaceProduct): Promise<MarketplaceResponse<void>>;
  abstract deleteProduct(sku: string): Promise<MarketplaceResponse<void>>;

  // ==================== STOK & FİYAT ====================

  abstract updateStock(sku: string, quantity: number): Promise<MarketplaceResponse<void>>;
  abstract updatePrice(sku: string, price: number, currency?: string): Promise<MarketplaceResponse<void>>;

  // ==================== SİPARİŞ YÖNETİMİ ====================

  abstract getOrders(status?: string, page?: number, pageSize?: number): Promise<MarketplaceResponse<MarketplaceOrder[]>>;
  abstract updateOrder(orderNo: string, status: string): Promise<MarketplaceResponse<void>>;

  // ==================== KARGO & İADE ====================

  abstract createShipment(shipment: MarketplaceShipment): Promise<MarketplaceResponse<void>>;
  abstract cancelOrder(orderNo: string, reason?: string): Promise<MarketplaceResponse<void>>;

  // ==================== KATEGORİ & MARKA ====================

  abstract getCategories(): Promise<MarketplaceResponse<MarketplaceCategory[]>>;
  abstract getBrands(): Promise<MarketplaceResponse<MarketplaceBrand[]>>;

  // ==================== DOĞRULAMA ====================

  abstract validate(product: MarketplaceProduct): Promise<MarketplaceResponse<{ valid: boolean; errors: string[] }>>;

  // ==================== ADAPTER BİLGİSİ ====================

  getConfig(): MarketplaceConfig {
    return this.config;
  }

  getClient(): MarketplaceClient {
    return this.client;
  }

  /** Bağlantı durumunu değiştir */
  protected setConnectionStatus(status: ConnectionStatus): void {
    const previous = this.connectionStatus;
    this.connectionStatus = status;
    if (previous !== status) {
      console.log(`[${this.key}] Connection: ${previous} → ${status}`);
    }
  }
}
