// ==================== PAZARAMA ADAPTER V3 ====================
// StockProtection → MarketplaceAdapter → PazaramaAdapter → Pazarama API
// Strateji: stok güncelle
// V3: getHealthScore eklendi
// =============================================================

import { MarketplaceAdapter, AdapterResult, AdapterHealthResult, AdapterHealthScore } from './MarketplaceAdapter.ts';
import { prisma } from '../../db/prisma.ts';

const p = prisma as any;

export class PazaramaAdapter implements MarketplaceAdapter {
  async closeListing(marketplaceKey: string, _productId: string, sku: string): Promise<AdapterResult> {
    return this.updateStock(marketplaceKey, _productId, sku, 0);
  }

  async openListing(marketplaceKey: string, productId: string, sku: string): Promise<AdapterResult> {
    try {
      const product = await p.product.findUnique({
        where: { id: productId },
        select: { stock: true },
      });
      const stock = product?.stock ?? 1;
      return this.updateStock(marketplaceKey, productId, sku, stock);
    } catch (err: any) {
      return { success: false, message: err.message, marketplaceKey, durationMs: 0, error: err.message };
    }
  }

  async updateStock(marketplaceKey: string, _productId: string, sku: string, stock: number): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const mp = await p.marketplace.findUnique({ where: { key: marketplaceKey } });
      if (!mp) throw new Error(`Marketplace ${marketplaceKey} bulunamadı`);

      const apiKey = mp.apiKey;
      const apiSecret = mp.apiSecret;
      if (!apiKey || !apiSecret) throw new Error('Pazarama API Key veya Secret eksik');

      const baseUrl = mp.apiUrl || 'https://api.pazarama.com';
      const url = `${baseUrl}/v1/product/stock`;

      const body = JSON.stringify({
        productStockRequests: [{
          sku: sku,
          stock: stock,
        }]
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'DG-STOK-V5.0/1.0',
        },
        body,
      });

      const responseBody = await response.text();
      const durationMs = Date.now() - start;

      if (response.ok) {
        return {
          success: true,
          message: `Pazarama stock updated for SKU ${sku}: ${stock}`,
          marketplaceKey,
          durationMs,
          httpStatus: response.status,
          apiResponse: responseBody,
        };
      } else {
        return {
          success: false,
          message: `Pazarama API error: ${response.status}`,
          marketplaceKey,
          durationMs,
          httpStatus: response.status,
          apiResponse: responseBody,
          error: responseBody,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message,
        marketplaceKey,
        durationMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  async health(marketplaceKey: string): Promise<AdapterHealthResult> {
    const start = Date.now();
    try {
      const mp = await p.marketplace.findUnique({ where: { key: marketplaceKey } });
      if (!mp) throw new Error('Bulunamadı');
      const baseUrl = mp.apiUrl || 'https://api.pazarama.com';
      const response = await fetch(`${baseUrl}/health`, { method: 'GET' });
      return { healthy: response.ok, marketplaceKey, latency: Date.now() - start };
    } catch {
      return { healthy: false, marketplaceKey, latency: Date.now() - start, error: 'Health check failed' };
    }
  }

  async getCriticalStockLevel(marketplaceKey: string): Promise<number | null> {
    try {
      const mp = await p.marketplace.findUnique({
        where: { key: marketplaceKey },
        select: { criticalStockLevel: true },
      });
      return mp?.criticalStockLevel ?? null;
    } catch {
      return null;
    }
  }

  async getHealthScore(marketplaceKey: string): Promise<AdapterHealthScore> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let marketplaceName = marketplaceKey;
    try {
      const mp = await p.marketplace.findUnique({ where: { key: marketplaceKey }, select: { name: true } });
      if (mp) marketplaceName = mp.name;
    } catch { /* ignore */ }

    const [totalRequests, successCount, todayErrors, retryAgg, recentLogs] = await Promise.all([
      p.stockProtectionLog.count({ where: { marketplaceKey } }),
      p.stockProtectionLog.count({ where: { marketplaceKey, success: true } }),
      p.stockProtectionLog.count({ where: { marketplaceKey, success: false, createdAt: { gte: today } } }),
      p.stockProtectionLog.aggregate({ where: { marketplaceKey }, _sum: { retryCount: true } }),
      p.stockProtectionLog.findMany({
        where: { marketplaceKey, createdAt: { gte: last24h } },
        select: { success: true, durationMs: true, httpStatus: true },
      }),
    ]);

    const http429 = recentLogs.filter((l: any) => l.httpStatus === 429).length;
    const http401 = recentLogs.filter((l: any) => l.httpStatus === 401).length;
    const http500 = recentLogs.filter((l: any) => l.httpStatus === 500).length;
    const otherErrors = recentLogs.filter((l: any) => !l.success && ![429, 401, 500].includes(l.httpStatus)).length;
    const totalLatency = recentLogs.reduce((sum: number, l: any) => sum + (l.durationMs || 0), 0);
    const averageLatency = recentLogs.length > 0 ? Math.round(totalLatency / recentLogs.length) : 0;
    const successRate = totalRequests > 0 ? Math.round((successCount / totalRequests) * 1000) / 10 : 100;
    const last24hSuccess = recentLogs.filter((l: any) => l.success).length;
    const last24hSuccessRate = recentLogs.length > 0 ? Math.round((last24hSuccess / recentLogs.length) * 1000) / 10 : 100;

    return {
      marketplaceKey, marketplaceName,
      healthy: last24hSuccessRate >= 50,
      successRate, averageLatency, todayErrors,
      totalRetries: (retryAgg as any)?._sum?.retryCount || 0,
      http429, http401, http500, otherErrors,
      totalRequests, last24hSuccessRate,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}
