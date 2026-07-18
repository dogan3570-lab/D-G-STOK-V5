// ==================== TRENDYOL ATTRIBUTE SERVİSİ V1.0 ====================
// Trendyol Category Attribute API üzerinden attribute ID'lerini alır.
// Kategori Eşleştirme modülüne DOKUNMADAN çalışır.
// ========================================================================

import { CorrelationId, createCorrelationId } from '../../eventBus/events.ts';
import { MarketplaceClient } from '../core/MarketplaceClient.ts';
import { MarketplaceLogger } from '../core/MarketplaceLogger.ts';
import { MarketplaceConfig } from '../core/MarketplaceTypes.ts';
import { createSuccessResponse, createErrorResponse, MarketplaceResponse } from '../core/MarketplaceResponse.ts';

export interface TrendyolAttribute {
  id: number;
  name: string;
  required: boolean;
  allowCustom: boolean;
  var: boolean;
  localizedName?: string;
  values?: TrendyolAttributeValue[];
}

export interface TrendyolAttributeValue {
  id: number;
  name: string;
  localizedName?: string;
}

/**
 * Trendyol Attribute Servisi.
 * 
 * Kullanım:
 * ```typescript
 * const attrService = await TrendyolAttributeService.create('trendyol');
 * const attrs = await attrService.getCategoryAttributes(123);
 * // attrs[0].id → gerçek attributeId
 * ```
 */
export class TrendyolAttributeService {
  private client: MarketplaceClient;
  private config: MarketplaceConfig;
  private supplierId: number;
  private authHeaders: Record<string, string>;
  private attributeCache = new Map<number, { attrs: TrendyolAttribute[]; expiresAt: number }>();
  private static readonly CACHE_TTL = 60 * 60 * 1000; // 1 saat

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

  static async create(marketplaceKey: string = 'trendyol'): Promise<TrendyolAttributeService> {
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

    return new TrendyolAttributeService(client, config, supplierId, authHeaders);
  }

  private endpoint(path: string): string {
    const isStage = this.config.baseUrl.includes('stageapi') || this.config.baseUrl.includes('stage');
    const prodPrefix = '/sapigw';
    const prefix = isStage ? '/stagesapigw' : prodPrefix;
    return `${prefix}/suppliers/${this.supplierId}${path}`;
  }

  /**
   * Kategoriye ait attribute'leri getir.
   * Sonuçlar 1 saat cache'lenir.
   * 
   * Trendyol API: GET /api/suppliers/{supplierId}/categories/{categoryId}/attributes
   */
  async getCategoryAttributes(categoryId: number): Promise<MarketplaceResponse<TrendyolAttribute[]>> {
    const cid = createCorrelationId('API');

    // Cache kontrolü
    const cached = this.attributeCache.get(categoryId);
    if (cached && cached.expiresAt > Date.now()) {
      return createSuccessResponse(cached.attrs, {
        status: 200, duration: 0, correlationId: cid,
      });
    }

    MarketplaceLogger.logMessage('INFO', `📋 Fetching attributes for category #${categoryId} [${cid}]`, {
      marketplaceKey: 'trendyol', correlationId: cid, operation: 'health',
    });

    try {
      const result = await this.client.get<any>(this.endpoint(`/categories/${categoryId}/attributes`), {
        operation: 'health', correlationId: cid, authHeaders: this.authHeaders,
      });

      if (!result.success) {
        return result;
      }

      const attributes = this.normalizeAttributes(result.data);

      // Cache'e ekle
      this.attributeCache.set(categoryId, {
        attrs: attributes,
        expiresAt: Date.now() + TrendyolAttributeService.CACHE_TTL,
      });

      MarketplaceLogger.logMessage('INFO', `📋 Category #${categoryId}: ${attributes.length} attributes loaded [${cid}]`, {
        marketplaceKey: 'trendyol', correlationId: cid, operation: 'health',
      });

      return createSuccessResponse(attributes, {
        status: result.status, duration: result.duration, correlationId: cid,
      });

    } catch (err: any) {
      return createErrorResponse({
        code: 'NETWORK_ERROR', message: err.message,
        duration: 0, correlationId: cid, recoverable: true,
      });
    }
  }

  /**
   * Ürün attribute'larını gerçek ID'lerle eşleştir.
   * 
   * @param categoryId - Trendyol kategori ID'si
   * @param attributes - { key: value } formatında ürün attribute'ları
   * @returns TrendyolAttribute[] - ID'lerle birlikte
   */
  async mapProductAttributes(
    categoryId: number,
    attributes: Record<string, string>
  ): Promise<{ attributeId: number; attributeValueId?: number; customAttributeValue?: string }[]> {
    const result: { attributeId: number; attributeValueId?: number; customAttributeValue?: string }[] = [];

    const attrResponse = await this.getCategoryAttributes(categoryId);
    if (!attrResponse.success || !attrResponse.data) {
      // Attribute API çağrılamazsa customAttributeValue ile gönder
      return Object.entries(attributes).map(([key, value]) => ({
        attributeId: 0,
        customAttributeValue: `${key}: ${value}`,
      }));
    }

    const categoryAttrs = attrResponse.data;

    for (const [key, value] of Object.entries(attributes)) {
      const matchedAttr = categoryAttrs.find(
        a => a.name.toLowerCase() === key.toLowerCase() ||
             a.localizedName?.toLowerCase() === key.toLowerCase()
      );

      if (matchedAttr) {
        // Attribute ID bulundu
        const entry: { attributeId: number; attributeValueId?: number; customAttributeValue?: string } = {
          attributeId: matchedAttr.id,
        };

        // Value ID'sini bul (varsa)
        if (matchedAttr.values && matchedAttr.values.length > 0) {
          const matchedValue = matchedAttr.values.find(
            v => v.name.toLowerCase() === value.toLowerCase()
          );
          if (matchedValue) {
            entry.attributeValueId = matchedValue.id;
          } else if (matchedAttr.allowCustom) {
            entry.customAttributeValue = value;
          }
        } else {
          entry.customAttributeValue = value;
        }

        result.push(entry);
      } else {
        // Attribute bulunamadı, custom olarak gönder
        result.push({
          attributeId: 0,
          customAttributeValue: `${key}: ${value}`,
        });
      }
    }

    return result;
  }

  /**
   * Cache'i temizle.
   */
  clearCache(): void {
    this.attributeCache.clear();
  }

  private normalizeAttributes(apiResponse: any): TrendyolAttribute[] {
    try {
      const items = apiResponse?.categoryAttributes || apiResponse?.attributes || apiResponse || [];
      if (!Array.isArray(items)) return [];
      return items.map((item: any) => ({
        id: item.id || item.attributeId || 0,
        name: item.name || item.attributeName || '',
        required: item.required === true,
        allowCustom: item.allowCustom !== false,
        var: item.var === true,
        localizedName: item.localizedName,
        values: (item.values || item.attributeValues || []).map((v: any) => ({
          id: v.id || v.valueId || 0,
          name: v.name || v.value || '',
          localizedName: v.localizedName,
        })),
      }));
    } catch { return []; }
  }
}
