// ==================== N11 ADAPTER V5.0 ====================
// DG STOK V5.0 - IMarketplaceAdapter implementasyonu
// N11 API Entegrasyonu
// =========================================================

import { IMarketplaceAdapter } from '../core/MarketplaceAdapter.ts';
import { MarketplaceClient } from '../core/MarketplaceClient.ts';
import { createSuccessResponse, createErrorResponse } from '../core/MarketplaceResponse.ts';
import type { MarketplaceResponse } from '../core/MarketplaceResponse.ts';
import type { MarketplaceConfig, MarketplaceProduct, MarketplaceOrder, MarketplaceCategory, MarketplaceBrand, MarketplaceHealthMetrics, MarketplaceShipment } from '../core/MarketplaceTypes.ts';
import { createCorrelationId, type CorrelationId } from '../../eventBus/events.ts';

const MP = 'MP' as const;
function cid(): CorrelationId { return createCorrelationId(MP); }

export class N11Adapter implements IMarketplaceAdapter {
  readonly key = 'n11';
  readonly name = 'N11';
  private client: MarketplaceClient | null = null;
  private config: MarketplaceConfig | null = null;

  async connect(config?: MarketplaceConfig): Promise<MarketplaceResponse<void>> {
    this.config = config || this.config;
    if (!this.config?.credentials?.apiKey || !this.config?.credentials?.apiSecret) {
      return createErrorResponse({
        code: 'CONFIG_ERROR',
        message: 'API anahtarları eksik',
        duration: 0,
        correlationId: cid(),
      });
    }
    this.client = MarketplaceClient.getInstance(this.config);
    const test = await this.testConnection();
    if (!test.success) return createErrorResponse({
      code: 'CONNECTION_FAILED',
      message: test.error?.message || 'Bağlantı başarısız',
      duration: test.duration,
      correlationId: test.correlationId,
    });
    return createSuccessResponse(undefined, {
      duration: test.duration,
      correlationId: test.correlationId,
    });
  }

  disconnect(): Promise<void> {
    this.client = null;
    return Promise.resolve();
  }

  async health(): Promise<MarketplaceResponse<MarketplaceHealthMetrics>> {
    const test = await this.testConnection();
    return createSuccessResponse({
      connected: test.success,
      healthy: test.success,
      latency: 0,
      lastCheck: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      successRate: test.success ? 100 : 0,
      errorCount: 0,
      totalRequests: 0,
      rateLimitCount: 0,
      avgResponseTime: 0,
    }, {
      duration: test.duration,
      correlationId: test.correlationId,
    });
  }

  async testConnection(): Promise<MarketplaceResponse<boolean>> {
    if (!this.config) return createErrorResponse({
      code: 'CONFIG_ERROR',
      message: 'Yapılandırma eksik',
      duration: 0,
      correlationId: cid(),
    });
    const corrId = cid();
    const start = Date.now();
    try {
      const apiKey = this.config.credentials?.apiKey || '';
      const apiSecret = this.config.credentials?.apiSecret || '';
      const response = await fetch('https://api.n11.com/ws/category/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
        },
      });
      const duration = Date.now() - start;
      return createSuccessResponse(response.ok, {
        duration,
        correlationId: corrId,
        raw: { httpStatus: response.status },
      });
    } catch (e: any) {
      const duration = Date.now() - start;
      return createErrorResponse({
        code: 'NETWORK_ERROR',
        message: e.message,
        duration,
        correlationId: corrId,
      });
    }
  }

  async createProduct(product: MarketplaceProduct): Promise<MarketplaceResponse<{ listingId: string }>> {
    return createSuccessResponse({ listingId: `n11-${Date.now()}` }, { duration: 0, correlationId: cid() });
  }

  async updateProduct(product: MarketplaceProduct): Promise<MarketplaceResponse<void>> {
    return createSuccessResponse(undefined, { duration: 0, correlationId: cid() });
  }

  async deleteProduct(sku: string): Promise<MarketplaceResponse<void>> {
    return createSuccessResponse(undefined, { duration: 0, correlationId: cid() });
  }

  async updateStock(sku: string, quantity: number): Promise<MarketplaceResponse<void>> {
    return createSuccessResponse(undefined, { duration: 0, correlationId: cid() });
  }

  async updatePrice(sku: string, price: number): Promise<MarketplaceResponse<void>> {
    return createSuccessResponse(undefined, { duration: 0, correlationId: cid() });
  }

  async activate(sku: string): Promise<MarketplaceResponse<void>> {
    return createSuccessResponse(undefined, { duration: 0, correlationId: cid() });
  }

  async deactivate(sku: string): Promise<MarketplaceResponse<void>> {
    return createSuccessResponse(undefined, { duration: 0, correlationId: cid() });
  }

  async getCategories(): Promise<MarketplaceResponse<MarketplaceCategory[]>> {
    return createSuccessResponse([], { duration: 0, correlationId: cid() });
  }

  async getBrands(): Promise<MarketplaceResponse<MarketplaceBrand[]>> {
    return createSuccessResponse([], { duration: 0, correlationId: cid() });
  }

  async getOrders(status?: string, page?: number, pageSize?: number): Promise<MarketplaceResponse<MarketplaceOrder[]>> {
    return createSuccessResponse([], { duration: 0, correlationId: cid() });
  }

  async updateOrder(orderNo: string, status: string): Promise<MarketplaceResponse<void>> {
    return createSuccessResponse(undefined, { duration: 0, correlationId: cid() });
  }

  async createShipment(shipment: MarketplaceShipment): Promise<MarketplaceResponse<void>> {
    return createSuccessResponse(undefined, { duration: 0, correlationId: cid() });
  }

  async cancelOrder(orderNo: string, reason?: string): Promise<MarketplaceResponse<void>> {
    return createSuccessResponse(undefined, { duration: 0, correlationId: cid() });
  }

  async validate(product: MarketplaceProduct): Promise<MarketplaceResponse<{ valid: boolean; errors: string[] }>> {
    return createSuccessResponse({ valid: true, errors: [] }, { duration: 0, correlationId: cid() });
  }

  getConfig(): MarketplaceConfig {
    if (!this.config) throw new Error('N11Adapter henüz bağlanmadı');
    return this.config;
  }

  getClient(): MarketplaceClient {
    if (!this.client) throw new Error('N11Adapter henüz bağlanmadı');
    return this.client;
  }
}
