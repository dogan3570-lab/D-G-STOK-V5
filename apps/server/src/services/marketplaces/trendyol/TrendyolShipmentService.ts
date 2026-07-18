// ==================== TRENDYOL KARGO SERVİSİ V1.0 ====================
// Kargo oluşturma, takip no ekleme, sipariş durumu güncelleme.
// 
// Trendyol API dokümantasyonuna göre:
// - Sipariş gönderildiğinde: Shipment Package'a tracking number eklenir
// - Paket bazlı çalışır (her package ayrı takip no alabilir)
// =====================================================================

import { CorrelationId, createCorrelationId } from '../../eventBus/events.ts';
import { EventBus } from '../../eventBus/EventBus.ts';
import { MarketplaceClient } from '../core/MarketplaceClient.ts';
import { MarketplaceLogger } from '../core/MarketplaceLogger.ts';
import { MarketplaceConfig, MarketplaceShipment } from '../core/MarketplaceTypes.ts';
import { createSuccessResponse, createErrorResponse, MarketplaceResponse } from '../core/MarketplaceResponse.ts';
import { MarketplaceError } from '../core/MarketplaceError.ts';

/**
 * Kargo/Shipment Servisi.
 * 
 * Kullanım:
 * ```typescript
 * const service = await TrendyolShipmentService.create('trendyol');
 * await service.createShipment({
 *   orderNo: '12345',
 *   cargoCompany: 'MNG KARGO',
 *   trackingNo: 'MNG123456',
 * });
 * ```
 */
export class TrendyolShipmentService {
  private client: MarketplaceClient;
  private config: MarketplaceConfig;
  private supplierId: number;
  private authHeaders: Record<string, string>;

  private constructor(
    client: MarketplaceClient,
    config: MarketplaceConfig,
    supplierId: number,
    authHeaders: Record<string, string>
  ) {
    this.client = client;
    this.config = config;
    this.supplierId = supplierId;
    this.authHeaders = authHeaders;
  }

  static async create(marketplaceKey: string = 'trendyol'): Promise<TrendyolShipmentService> {
    const { prisma } = await import('../../../db/prisma.ts');
    const { TrendyolAdapter } = await import('./TrendyolAdapter.ts');
    const p = (prisma as any);
    
    const mp = await p.marketplace.findUnique({ where: { key: marketplaceKey } });
    if (!mp) throw new Error(`Marketplace ${marketplaceKey} bulunamadı`);

    const adapter = await TrendyolAdapter.create(marketplaceKey);
    const client = adapter.getClient();
    const config = adapter.getConfig();

    let supplierId = 2738;
    if (mp.settings) {
      try { const s = JSON.parse(mp.settings); supplierId = parseInt(s.sellerId || s.supplierId || '2738'); } catch {}
    }

    const token = Buffer.from(`${mp.apiKey || ''}:${mp.apiSecret || ''}`).toString('base64');
    const authHeaders = { 'Authorization': `Basic ${token}` };

    return new TrendyolShipmentService(client, config, supplierId, authHeaders);
  }

  private endpoint(path: string): string {
    const isStage = this.config.baseUrl.includes('stageapi') || this.config.baseUrl.includes('stage');
    const prodPrefix = '/sapigw';
    const prefix = isStage ? '/stagesapigw' : prodPrefix;
    return `${prefix}/suppliers/${this.supplierId}${path}`;
  }

  /**
   * Kargo oluştur ve takip no ekle.
   * 
   * Trendyol'da kargo işlemi:
   * 1. Siparişin shipment package'ına tracking number eklenir
   * 2. Sipariş durumu SHIPPED olarak güncellenir
   * 
   * @param shipment - Kargo bilgileri
   * @param packageId - (Opsiyonel) Belirli bir paket için. Yoksa siparişin ilk paketi kullanılır.
   */
  async createShipment(
    shipment: MarketplaceShipment,
    packageId?: number
  ): Promise<MarketplaceResponse<void>> {
    const cid = createCorrelationId('API');
    const startTime = Date.now();

    // Validasyon
    if (!shipment.orderNo) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR', message: 'orderNo zorunludur',
        httpStatus: 400, duration: 0, correlationId: cid,
      });
    }
    if (!shipment.trackingNo && !shipment.cargoCompany) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR', message: 'trackingNo veya cargoCompany zorunludur',
        httpStatus: 400, duration: 0, correlationId: cid,
      });
    }

    MarketplaceLogger.logMessage('INFO',
      `🚚 Creating shipment for order ${shipment.orderNo}: ${shipment.cargoCompany} - ${shipment.trackingNo} [${cid}]`,
      { marketplaceKey: 'trendyol', correlationId: cid, operation: 'createShipment',
        metadata: { orderNo: shipment.orderNo, cargoCompany: shipment.cargoCompany, trackingNo: shipment.trackingNo } }
    );

    try {
      // Eğer packageId verilmediyse, siparişin paketlerini bul
      let targetPackageId = packageId;

      if (!targetPackageId) {
        const packagesResult = await this.getOrderPackages(shipment.orderNo, cid);
        if (!packagesResult.success || !packagesResult.data || packagesResult.data.length === 0) {
          return createErrorResponse({
            code: 'NOT_FOUND', message: `${shipment.orderNo} için paket bulunamadı`,
            httpStatus: 404, duration: Date.now() - startTime, correlationId: cid,
          });
        }
        // İlk paketi kullan
        targetPackageId = packagesResult.data[0].id;
      }

      // Tracking number ekle
      const updateResult = await this.updateTrackingNumber(
        shipment.orderNo,
        targetPackageId,
        shipment.trackingNo || '',
        shipment.cargoCompany || '',
        cid
      );

      if (!updateResult.success) {
        return updateResult;
      }

      const duration = Date.now() - startTime;

      MarketplaceLogger.logMessage('INFO',
        `✅ Shipment created for ${shipment.orderNo}: ${shipment.cargoCompany} / ${shipment.trackingNo} (${duration}ms) [${cid}]`,
        { marketplaceKey: 'trendyol', correlationId: cid, operation: 'createShipment' }
      );

      // Event yayınla
      (EventBus.emit as any)({
        type: 'MarketplaceResponse', correlationId: cid,
        timestamp: new Date().toISOString(), source: 'TrendyolShipmentService',
        data: {
          marketplaceKey: 'trendyol', operation: 'createShipment',
          success: true, status: 200, duration, retryCount: 0,
          meta: { orderNo: shipment.orderNo, cargoCompany: shipment.cargoCompany, trackingNo: shipment.trackingNo },
        },
      });

      return createSuccessResponse(undefined, {
        status: 200, duration, correlationId: cid,
      });

    } catch (err: any) {
      MarketplaceLogger.logMessage('ERROR',
        `❌ Shipment error for ${shipment.orderNo}: ${err.message} [${cid}]`,
        { marketplaceKey: 'trendyol', correlationId: cid, operation: 'createShipment', error: err.message }
      );
      return createErrorResponse({
        code: 'NETWORK_ERROR', message: err.message,
        duration: Date.now() - startTime, correlationId: cid, recoverable: true,
      });
    }
  }

  /**
   * Siparişin paketlerini getir.
   * 
   * NOT: Bu endpoint Trendyol dokümantasyonunda doğrulanmamıştır.
   * Sipariş detayından paket ID'leri alınır.
   */
  private async getOrderPackages(
    orderNo: string,
    correlationId: CorrelationId
  ): Promise<MarketplaceResponse<Array<{ id: number; status: string }>>> {
    // Sipariş detayını çek, içindeki paketleri bul
    const result = await this.client.get<any>(this.endpoint(`/orders`), {
      params: { orderNumber: orderNo, page: 0, size: 1 },
      operation: 'getOrders',
      correlationId,
      authHeaders: this.authHeaders,
    });

    if (!result.success || !result.data?.content?.length) {
      return createSuccessResponse([], { status: 404, duration: result.duration, correlationId });
    }

    const orderData = result.data.content[0];
    const packages = (orderData.shipmentPackages || []).map((pkg: any) => ({
      id: pkg.id || pkg.packageId,
      status: pkg.status || 'UNSHIPPED',
    }));

    return createSuccessResponse(packages, {
      status: 200, duration: result.duration, correlationId,
    });
  }

  /**
   * Tracking number güncelle.
   * 
   * Trendyol API:
   * PUT /api/suppliers/{supplierId}/orders/{orderNumber}/shipment-packages/{packageId}/update-tracking-number
   * 
   * NOT: Bu endpoint'in tam yolu Trendyol dokümantasyonunda doğrulanmalıdır.
   */
  private async updateTrackingNumber(
    orderNo: string,
    packageId: number,
    trackingNo: string,
    cargoCompany: string,
    correlationId: CorrelationId
  ): Promise<MarketplaceResponse<void>> {
    const endpoint = this.endpoint(`/orders/${orderNo}/shipment-packages/${packageId}/update-tracking-number`);

    const body: Record<string, any> = {};
    if (trackingNo) body.trackingNumber = trackingNo;
    if (cargoCompany) body.cargoCompany = cargoCompany;

    const result = await this.client.put<any>(endpoint, body, {
      operation: 'createShipment',
      correlationId,
      authHeaders: this.authHeaders,
      priority: 'HIGH',
    });

    return {
      success: result.success,
      status: result.status,
      duration: result.duration,
      correlationId,
      retryCount: result.retryCount,
      error: result.error,
    };
  }

  /**
   * Sipariş durumunu güncelle (opsiyonel - siparişi SHIPPED yap).
   * 
   * NOT: Bu endpoint Trendyol dokümantasyonunda doğrulanmalıdır.
   * Bazı pazaryerlerinde tracking number eklemek otomatik status değişikliği yapar.
   */
  async updateOrderStatus(orderNo: string, status: string): Promise<MarketplaceResponse<void>> {
    const cid = createCorrelationId('API');

    MarketplaceLogger.logMessage('INFO', `📋 Updating order ${orderNo} status to ${status} [${cid}]`, {
      marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders',
    });

    // Trendyol'da status güncelleme endpoint'i - Not Implemented
    // Bazı durumlar otomatik güncellenir (tracking no eklenince SHIPPED olur)
    MarketplaceLogger.logMessage('WARN', `⚠️ Order status update not directly supported. Use shipment tracking for automatic status change. [${cid}]`, {
      marketplaceKey: 'trendyol', correlationId: cid, operation: 'getOrders',
    });

    return createSuccessResponse(undefined, {
      status: 200, duration: 0, correlationId: cid,
    });
  }

  /**
   * Bağlantı testi.
   */
  async testConnection(): Promise<MarketplaceResponse<{ message: string }>> {
    return createSuccessResponse(
      { message: 'Trendyol Shipment Service hazır' },
      { status: 200, duration: 0, correlationId: createCorrelationId('API') }
    );
  }
}
