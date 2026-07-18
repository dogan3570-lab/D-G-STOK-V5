// ==================== AKILLI STOK KORUMA MOTORU V3.0 ====================
// XML stok güncellemesi → kritik stok kontrolü → otomatik aç/kapa
// V3: Ürün bazlı kritik stok, kapatmadan önce son kontrol, acil durum modu,
//     karar simülasyonu, adapter sağlık puanı
// V3.1: Event Bus + Correlation ID entegrasyonu
// KURAL 3: Modüller birbirini çağırmaz, event yayınlar.
// KURAL 4: Her işlemin benzersiz Correlation ID'si vardır.
// ======================================================================

import { prisma } from '../../db/prisma.ts';
import { MarketplaceAdapter, DefaultMarketplaceAdapter, AdapterHealthScore } from './MarketplaceAdapter.ts';
import { getAdapter } from './AdapterRegistry.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId, CorrelationId } from '../eventBus/events.ts';

const p = prisma as any;

export type TriggerType = 'XML_SCHEDULER' | 'XML_MANUAL' | 'MANUAL' | 'API' | 'BATCH';

export interface StockProtectionConfig {
  enabled: boolean;
  /** true = globalCriticalStock kullan, false = her pazaryeri kendi seviyesini belirler */
  useGlobalCriticalStock: boolean;
  /** useGlobalCriticalStock=true iken kullanılır */
  globalCriticalStock: number;
  autoCloseEnabled: boolean;
  autoOpenEnabled: boolean;
  waitMs: number;
  maxRetries: number;
  timeoutMs: number;
  /** V2.5: Kapatmadan önce marketplace API'den gerçek stok sorgula */
  verifyBeforeClose: boolean;
}

export interface StockAction {
  correlationId: string;
  productId: string;
  sku: string;
  productName: string;
  barcode?: string;
  xmlSourceId?: string;
  xmlSourceName?: string;
  marketplaceKey: string;
  marketplaceName?: string;
  action: 'CLOSED' | 'OPENED';
  decision: 'CLOSE' | 'OPEN' | 'SKIP';
  reason: string;
  stockBefore: number;
  stockAfter: number;
  criticalLevel: number;
  /** V2.5: Hangi seviyeden criticalLevel alındı (product/marketplace/global) */
  criticalLevelSource?: 'product' | 'marketplace' | 'global';
  /** V2.5: API doğrulama sonrası gerçek stok (varsa) */
  verifiedStock?: number;
  success: boolean;
  httpStatus?: number;
  apiResponse?: string;
  errorMessage?: string;
  durationMs: number;
  retryCount: number;
  triggerType: TriggerType;
}

export interface SimulationResult {
  correlationId: string;
  sku: string;
  productId: string;
  productName: string;
  xmlStock: number;
  marketplaces: Array<{
    marketplaceKey: string;
    marketplaceName?: string;
    criticalLevel: number;
    criticalLevelSource: 'product' | 'marketplace' | 'global';
    decision: 'CLOSE' | 'OPEN' | 'SKIP';
    reason: string;
    wouldClose: boolean;
    wouldOpen: boolean;
    expectedAction: string;
  }>;
}

interface ProductInfo {
  id: string;
  sku: string | null;
  title: string | null;
  barcode: string | null;
  stock: number;
  xmlSourceId: string | null;
  criticalStockLevel: number | null;
}

const DEFAULT_CONFIG: StockProtectionConfig = {
  enabled: true,
  useGlobalCriticalStock: true,
  globalCriticalStock: 3,
  autoCloseEnabled: true,
  autoOpenEnabled: true,
  waitMs: 30000,
  maxRetries: 3,
  timeoutMs: 30000,
  verifyBeforeClose: false,
};

export class StockProtectionEngine {
  private config: StockProtectionConfig;
  private actionLog: StockAction[] = [];
  private processingProducts: Set<string> = new Set();
  private _isRunning = false;
  /** V3: Acil durum modu - tüm otomatik kapatma işlemlerini durdur */
  private _emergencyStop = false;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadEmergencyStopState();
  }

  get isRunning(): boolean { return this._isRunning; }
  get isEmergencyStop(): boolean { return this._emergencyStop; }

  private async loadEmergencyStopState(): Promise<void> {
    try {
      const setting = await p.setting.findUnique({ where: { key: 'stock_protection_emergency_stop' } });
      if (setting) {
        this._emergencyStop = setting.value === 'true';
      }
    } catch { /* ilk çalıştırmada tablo olmayabilir */ }
  }

  // ==================== KONFİGÜRASYON ====================

  getConfig(): StockProtectionConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<StockProtectionConfig>): StockProtectionConfig {
    this.config = { ...this.config, ...partial };
    return this.getConfig();
  }

  // ==================== ACİL DURUM MODU V3 ====================

  async setEmergencyStop(active: boolean, triggeredBy?: string): Promise<boolean> {
    this._emergencyStop = active;
    try {
      await p.setting.upsert({
        where: { key: 'stock_protection_emergency_stop' },
        update: { value: active ? 'true' : 'false' },
        create: { key: 'stock_protection_emergency_stop', value: active ? 'true' : 'false' },
      });
    } catch { /* SQLite olmayabilir */ }

    // V3.1: Event yayınla
    const correlationId = createCorrelationId('API');
    EventBus.emit({
      type: 'EmergencyStop',
      correlationId,
      timestamp: new Date().toISOString(),
      source: 'StockProtectionEngine',
      data: { active, triggeredBy },
    });

    console.log(`[StockProtection] Emergency stop ${active ? 'ACTIVATED' : 'DEACTIVATED'} [${correlationId}]`);
    return active;
  }

  getEmergencyStopStatus(): { active: boolean; activatedAt?: string } {
    return { active: this._emergencyStop };
  }

  // ==================== KRİTİK STOK SEVİYESİ V3 ====================
  // Karar sırası:
  //   1. Ürün Bazlı Kritik Stok (Product.criticalStockLevel)
  //   2. Pazaryeri Bazlı Kritik Stok (Marketplace.criticalStockLevel)
  //   3. Global Kritik Stok (config.globalCriticalStock)

  private async getEffectiveCriticalLevel(marketplaceKey: string, productId?: string): Promise<{ level: number; source: 'product' | 'marketplace' | 'global' }> {
    // 1. Ürün bazlı kontrol
    if (productId) {
      try {
        const product = await p.product.findUnique({
          where: { id: productId },
          select: { criticalStockLevel: true },
        });
        if (product?.criticalStockLevel !== null && product?.criticalStockLevel !== undefined && product.criticalStockLevel > 0) {
          return { level: product.criticalStockLevel, source: 'product' };
        }
      } catch { /* fallback */ }
    }

    // 2. Pazaryeri bazlı
    if (!this.config.useGlobalCriticalStock) {
      const adapter = getAdapter(marketplaceKey);
      const mpLevel = await adapter.getCriticalStockLevel(marketplaceKey);
      if (mpLevel !== null && mpLevel > 0) {
        return { level: mpLevel, source: 'marketplace' };
      }
      try {
        const mp = await p.marketplace.findUnique({
          where: { key: marketplaceKey },
          select: { criticalStockLevel: true },
        });
        if (mp?.criticalStockLevel !== null && mp?.criticalStockLevel !== undefined && mp.criticalStockLevel > 0) {
          return { level: mp.criticalStockLevel, source: 'marketplace' };
        }
      } catch { /* fallback */ }
    }

    // 3. Global
    return { level: this.config.globalCriticalStock, source: 'global' };
  }

  // ==================== KAPATMADAN ÖNCE SON KONTROL V3 ====================

  private async verifyStockBeforeClose(
    adapter: MarketplaceAdapter,
    marketplaceKey: string,
    productId: string,
    sku: string,
    xmlStock: number,
    correlationId: CorrelationId
  ): Promise<{ shouldClose: boolean; verifiedStock?: number; reason: string }> {
    if (!this.config.verifyBeforeClose) {
      return { shouldClose: true, reason: 'Doğrulama devre dışı' };
    }

    try {
      const result = await adapter.updateStock(marketplaceKey, productId, sku, xmlStock);
      
      if (result.success) {
        return {
          shouldClose: false,
          verifiedStock: xmlStock,
          reason: `API doğrulaması başarılı: stok=${xmlStock}, kapatma gerekmiyor`,
        };
      } else {
        return {
          shouldClose: true,
          reason: `API doğrulaması başarısız (${result.httpStatus}), kapatılıyor: ${result.error || ''}`,
        };
      }
    } catch (err: any) {
      return {
        shouldClose: true,
        reason: `API doğrulama hatası: ${err.message}, tedbir amaçlı kapatılıyor`,
      };
    }
  }

  // ==================== KARAR SİMÜLASYONU V3 ====================

  async simulateDecision(
    sku: string,
    xmlStock: number,
    marketplaceKeys?: string[]
  ): Promise<SimulationResult | { error: string }> {
    const correlationId = createCorrelationId('SP');

    try {
      const product = await p.product.findFirst({
        where: { sku },
        select: { id: true, sku: true, title: true, stock: true, criticalStockLevel: true },
      }) as ProductInfo | null;

      if (!product) {
        return { error: `SKU bulunamadı: ${sku}` };
      }

      const keys = marketplaceKeys || await this.getActiveMarketplaceKeys();
      const results: SimulationResult['marketplaces'] = [];

      for (const mpKey of keys) {
        const { level: criticalLevel, source: criticalLevelSource } = await this.getEffectiveCriticalLevel(mpKey, product.id);
        
        let marketplaceName: string | undefined;
        try {
          const mp = await p.marketplace.findUnique({ where: { key: mpKey }, select: { name: true } });
          marketplaceName = mp?.name;
        } catch { /* ignore */ }

        const adapter = getAdapter(mpKey);
        const adapterName = adapter.constructor.name.replace('Adapter', '');

        let decision: 'CLOSE' | 'OPEN' | 'SKIP';
        let reason: string;
        let wouldClose = false;
        let wouldOpen = false;
        let expectedAction: string;

        if (xmlStock <= criticalLevel && this.config.autoCloseEnabled) {
          decision = 'CLOSE';
          wouldClose = true;
          reason = `Kritik stok seviyesi (${xmlStock} ≤ ${criticalLevel})`;
          expectedAction = `${adapterName} → quantity=0 (pasif)`;
        } else if (xmlStock > criticalLevel && this.config.autoOpenEnabled) {
          decision = 'OPEN';
          wouldOpen = true;
          reason = `Stok normale döndü (${xmlStock} > ${criticalLevel})`;
          expectedAction = `${adapterName} → stok güncelle (${xmlStock})`;
        } else {
          decision = 'SKIP';
          reason = 'Aksiyon gerekmiyor (oto aç/kapa kapalı olabilir)';
          expectedAction = 'İşlem yapılmaz';
        }

        results.push({
          marketplaceKey: mpKey,
          marketplaceName,
          criticalLevel,
          criticalLevelSource,
          decision,
          reason,
          wouldClose,
          wouldOpen,
          expectedAction,
        });
      }

      return {
        correlationId,
        sku: product.sku || product.id,
        productId: product.id,
        productName: product.title || sku,
        xmlStock,
        marketplaces: results,
      };
    } catch (err: any) {
      return { error: `Simülasyon hatası: ${err.message}` };
    }
  }

  // ==================== ADAPTER SAĞLIK PUANI V3 ====================

  async getAllHealthScores(): Promise<AdapterHealthScore[]> {
    const scores: AdapterHealthScore[] = [];
    const keys = await this.getActiveMarketplaceKeys();

    for (const mpKey of keys) {
      try {
        const adapter = getAdapter(mpKey);
        const score = await adapter.getHealthScore(mpKey);
        scores.push(score);

        // V3.1: Health score event'i yayınla
        EventBus.emit({
          type: 'HealthScoreUpdated',
          correlationId: createCorrelationId('SP'),
          timestamp: new Date().toISOString(),
          source: 'StockProtectionEngine',
          data: {
            marketplaceKey: score.marketplaceKey,
            marketplaceName: score.marketplaceName,
            successRate: score.successRate,
            averageLatency: score.averageLatency,
            todayErrors: score.todayErrors,
            healthy: score.healthy,
          },
        });
      } catch (err: any) {
        scores.push({
          marketplaceKey: mpKey,
          marketplaceName: mpKey,
          healthy: false,
          successRate: 0,
          averageLatency: 0,
          todayErrors: 0,
          totalRetries: 0,
          http429: 0,
          http401: 0,
          http500: 0,
          otherErrors: 0,
          totalRequests: 0,
          last24hSuccessRate: 0,
          lastCheckedAt: new Date().toISOString(),
        });
      }
    }

    return scores;
  }

  async getHealthScoreFromLogs(marketplaceKey: string): Promise<AdapterHealthScore> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let marketplaceName: string | undefined;
    try {
      const mp = await p.marketplace.findUnique({ where: { key: marketplaceKey }, select: { name: true } });
      marketplaceName = mp?.name;
    } catch { /* ignore */ }

    const [totalRequests, successfulRequests, todayErrors, totalRetries, recentLogs] = await Promise.all([
      p.stockProtectionLog.count({ where: { marketplaceKey } }),
      p.stockProtectionLog.count({ where: { marketplaceKey, success: true } }),
      p.stockProtectionLog.count({ where: { marketplaceKey, success: false, createdAt: { gte: today } } }),
      p.stockProtectionLog.aggregate({ where: { marketplaceKey }, _sum: { retryCount: true } }),
      p.stockProtectionLog.findMany({
        where: { marketplaceKey, createdAt: { gte: last24h } },
        select: { success: true, durationMs: true, httpStatus: true, createdAt: true },
      }),
    ]);

    const http429 = recentLogs.filter((l: any) => l.httpStatus === 429).length;
    const http401 = recentLogs.filter((l: any) => l.httpStatus === 401).length;
    const http500 = recentLogs.filter((l: any) => l.httpStatus === 500).length;
    const otherErrors = recentLogs.filter((l: any) => !l.success && ![429, 401, 500].includes(l.httpStatus)).length;

    const totalLatency = recentLogs.reduce((sum: number, l: any) => sum + (l.durationMs || 0), 0);
    const averageLatency = recentLogs.length > 0 ? Math.round(totalLatency / recentLogs.length) : 0;

    const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 1000) / 10 : 100;
    const last24hTotal = recentLogs.length;
    const last24hSuccess = recentLogs.filter((l: any) => l.success).length;
    const last24hSuccessRate = last24hTotal > 0 ? Math.round((last24hSuccess / last24hTotal) * 1000) / 10 : 100;
    const healthy = last24hSuccessRate >= 50;

    return {
      marketplaceKey,
      marketplaceName: marketplaceName || marketplaceKey,
      healthy,
      successRate,
      averageLatency,
      todayErrors,
      totalRetries: (totalRetries as any)?._sum?.retryCount || 0,
      http429,
      http401,
      http500,
      otherErrors,
      totalRequests,
      last24hSuccessRate,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  // ==================== TEK ÜRÜN KONTROLÜ ====================
  // KURAL 4: Her işlemin Correlation ID'si vardır

  async checkProductStock(
    productId: string,
    xmlStock: number,
    marketplaceKeys: string[],
    triggerType: TriggerType = 'MANUAL',
    correlationId?: CorrelationId
  ): Promise<StockAction[]> {
    const actions: StockAction[] = [];
    const cid = correlationId || createCorrelationId('SP');

    if (this._emergencyStop) {
      console.log(`[StockProtection] EMERGENCY STOP active - skipping product ${productId} [${cid}]`);
      return actions;
    }

    if (!this.config.enabled) return actions;
    if (this.processingProducts.has(productId)) return actions;

    this.processingProducts.add(productId);

    try {
      const product = await p.product.findUnique({
        where: { id: productId },
        select: { id: true, sku: true, title: true, barcode: true, stock: true, xmlSourceId: true, criticalStockLevel: true },
      }) as ProductInfo | null;

      if (!product) return actions;

      const sku = product.sku || product.id;
      const productName = product.title || sku;
      const currentStock = xmlStock;
      const isExempt = await this.isProductExempt(productId);

      if (isExempt) return actions;

      let xmlSourceName: string | undefined;
      let xmlSourceId: string | undefined;
      if (product.xmlSourceId) {
        xmlSourceId = product.xmlSourceId;
        try {
          const src = await p.xmlSource.findUnique({
            where: { id: product.xmlSourceId },
            select: { name: true },
          });
          xmlSourceName = src?.name;
        } catch { /* ignore */ }
      }

      for (const mpKey of marketplaceKeys) {
        const { level: criticalLevel, source: criticalLevelSource } = await this.getEffectiveCriticalLevel(mpKey, product.id);

        let marketplaceName: string | undefined;
        try {
          const mp = await p.marketplace.findUnique({
            where: { key: mpKey },
            select: { name: true },
          });
          marketplaceName = mp?.name;
        } catch { /* ignore */ }

        const adapter = getAdapter(mpKey);

        if (currentStock <= criticalLevel && this.config.autoCloseEnabled) {
          // ===== KAPAT (CLOSE) =====
          if (this.config.verifyBeforeClose) {
            const verification = await this.verifyStockBeforeClose(
              adapter, mpKey, productId, sku, currentStock, cid
            );

            if (!verification.shouldClose) {
              const skipAction: StockAction = {
                correlationId: cid,
                productId, sku, productName,
                barcode: product.barcode || undefined,
                xmlSourceId: xmlSourceId || undefined,
                xmlSourceName,
                marketplaceKey: mpKey,
                marketplaceName,
                action: 'OPENED',
                decision: 'SKIP',
                reason: verification.reason,
                stockBefore: product.stock || 0,
                stockAfter: currentStock,
                criticalLevel,
                criticalLevelSource,
                verifiedStock: verification.verifiedStock,
                success: true,
                durationMs: 0,
                retryCount: 0,
                triggerType,
              };
              actions.push(skipAction);
              this.actionLog.push(skipAction);
              await this.logAction(skipAction);

              // V3.1: Decision event'i yayınla
              EventBus.emit({
                type: 'StockProtectionDecision',
                correlationId: cid,
                timestamp: new Date().toISOString(),
                source: 'StockProtectionEngine',
                data: {
                  productId, sku, productName,
                  marketplaceKey: mpKey,
                  marketplaceName,
                  decision: 'SKIP',
                  reason: verification.reason,
                  currentStock,
                  criticalLevel,
                  criticalLevelSource,
                  action: null,
                },
              });
              continue;
            }
          }

          let result;
          let retryCount = 0;
          const maxRetries = this.config.maxRetries;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            retryCount = attempt;
            try {
              result = await adapter.closeListing(mpKey, productId, sku);
            } catch (err: any) {
              result = { success: false, message: err.message, marketplaceKey: mpKey, durationMs: 0, error: err.message };
            }

            // V3.1: Her denemede Marketplace response event'i yayınla
            EventBus.emit({
              type: 'MarketplaceResponse',
              correlationId: cid,
              timestamp: new Date().toISOString(),
              source: 'StockProtectionEngine',
              data: {
                marketplaceKey: mpKey,
                adapterName: adapter.constructor.name,
                operation: 'closeListing',
                sku,
                success: result?.success ?? false,
                durationMs: result?.durationMs ?? 0,
                httpStatus: (result as any)?.httpStatus,
                error: result?.error,
                retryCount: attempt,
                triggerType,
              },
            });

            if (result.success) break;
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, this.config.waitMs));
            }
          }

          const action: StockAction = {
            correlationId: cid,
            productId, sku, productName,
            barcode: product.barcode || undefined,
            xmlSourceId: xmlSourceId || undefined,
            xmlSourceName,
            marketplaceKey: mpKey,
            marketplaceName,
            action: 'CLOSED',
            decision: 'CLOSE',
            reason: `Kritik stok seviyesi (${currentStock} ≤ ${criticalLevel}) [${criticalLevelSource}]`,
            stockBefore: product.stock || 0,
            stockAfter: currentStock,
            criticalLevel,
            criticalLevelSource,
            success: result?.success ?? false,
            httpStatus: (result as any)?.httpStatus,
            apiResponse: (result as any)?.apiResponse,
            errorMessage: result?.error,
            durationMs: result?.durationMs ?? 0,
            retryCount,
            triggerType,
          };
          actions.push(action);
          this.actionLog.push(action);
          await this.logAction(action);

          // V3.1: Decision event'i yayınla
          EventBus.emit({
            type: 'StockProtectionDecision',
            correlationId: cid,
            timestamp: new Date().toISOString(),
            source: 'StockProtectionEngine',
            data: {
              productId, sku, productName,
              marketplaceKey: mpKey,
              marketplaceName,
              decision: 'CLOSE',
              reason: action.reason,
              currentStock,
              criticalLevel,
              criticalLevelSource,
              action: 'CLOSED',
            },
          });

        } else if (currentStock > criticalLevel && this.config.autoOpenEnabled) {
          // ===== AÇ (OPEN) =====
          let result;
          let retryCount = 0;
          const maxRetries = this.config.maxRetries;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            retryCount = attempt;
            try {
              result = await adapter.openListing(mpKey, productId, sku);
            } catch (err: any) {
              result = { success: false, message: err.message, marketplaceKey: mpKey, durationMs: 0, error: err.message };
            }

            // V3.1: Her denemede Marketplace response event'i yayınla
            EventBus.emit({
              type: 'MarketplaceResponse',
              correlationId: cid,
              timestamp: new Date().toISOString(),
              source: 'StockProtectionEngine',
              data: {
                marketplaceKey: mpKey,
                adapterName: adapter.constructor.name,
                operation: 'openListing',
                sku,
                success: result?.success ?? false,
                durationMs: result?.durationMs ?? 0,
                httpStatus: (result as any)?.httpStatus,
                error: result?.error,
                retryCount: attempt,
                triggerType,
              },
            });

            if (result.success) break;
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, this.config.waitMs));
            }
          }

          const action: StockAction = {
            correlationId: cid,
            productId, sku, productName,
            barcode: product.barcode || undefined,
            xmlSourceId: xmlSourceId || undefined,
            xmlSourceName,
            marketplaceKey: mpKey,
            marketplaceName,
            action: 'OPENED',
            decision: 'OPEN',
            reason: `Stok normale döndü (${currentStock} > ${criticalLevel}) [${criticalLevelSource}]`,
            stockBefore: product.stock || 0,
            stockAfter: currentStock,
            criticalLevel,
            criticalLevelSource,
            success: result?.success ?? false,
            httpStatus: (result as any)?.httpStatus,
            apiResponse: (result as any)?.apiResponse,
            errorMessage: result?.error,
            durationMs: result?.durationMs ?? 0,
            retryCount,
            triggerType,
          };
          actions.push(action);
          this.actionLog.push(action);
          await this.logAction(action);

          // V3.1: Decision event'i yayınla
          EventBus.emit({
            type: 'StockProtectionDecision',
            correlationId: cid,
            timestamp: new Date().toISOString(),
            source: 'StockProtectionEngine',
            data: {
              productId, sku, productName,
              marketplaceKey: mpKey,
              marketplaceName,
              decision: 'OPEN',
              reason: action.reason,
              currentStock,
              criticalLevel,
              criticalLevelSource,
              action: 'OPENED',
            },
          });
        }
      }

      await p.product.update({
        where: { id: productId },
        data: { stock: currentStock, lastStockCheckAt: new Date() },
      });

    } finally {
      this.processingProducts.delete(productId);
    }

    return actions;
  }

  // ==================== TOPLU İŞLEM ====================

  async batchCheck(
    stockUpdates: Array<{ productId: string; stock: number }>,
    marketplaceKeys: string[],
    triggerType: TriggerType = 'MANUAL',
    correlationId?: CorrelationId
  ): Promise<{ totalActions: number; closed: number; opened: number; skipped: number; errors: number }> {
    const cid = correlationId || createCorrelationId('BATCH');

    if (this._emergencyStop) {
      console.log(`[StockProtection] EMERGENCY STOP active - batch skipped [${cid}]`);
      return { totalActions: 0, closed: 0, opened: 0, skipped: 0, errors: 0 };
    }

    let closed = 0;
    let opened = 0;
    let skipped = 0;
    let errors = 0;

    const BATCH_SIZE = 100;
    for (let i = 0; i < stockUpdates.length; i += BATCH_SIZE) {
      const batch = stockUpdates.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(up => this.checkProductStock(up.productId, up.stock, marketplaceKeys, triggerType, cid))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const action of r.value) {
            if (action.action === 'CLOSED') closed++;
            else if (action.action === 'OPENED') opened++;
            else skipped++;
          }
        } else {
          errors++;
        }
      }
    }

    return { totalActions: closed + opened, closed, opened, skipped, errors };
  }

  // ==================== XML İŞLEME ====================

  async processXmlStockUpdate(
    xmlSourceId: string,
    products: Array<{ productId: string; stock: number }>,
    triggerType: TriggerType = 'XML_SCHEDULER'
  ): Promise<{ processed: number; actions: StockAction[]; runId: string }> {
    const correlationId = createCorrelationId('XML');

    if (this._emergencyStop) {
      console.log(`[StockProtection] EMERGENCY STOP active - XML update skipped for source ${xmlSourceId} [${correlationId}]`);
      const run = await p.stockProtectionRun.create({
        data: {
          xmlSourceId,
          triggerType,
          productCount: products.length,
          status: 'SKIPPED',
          errorDetail: 'EMERGENCY_STOP_ACTIVE',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
        },
      });
      return { processed: 0, actions: [], runId: run.id };
    }

    let xmlSourceName: string | undefined;
    try {
      const src = await p.xmlSource.findUnique({
        where: { id: xmlSourceId },
        select: { name: true },
      });
      xmlSourceName = src?.name;
    } catch { /* ignore */ }

    const marketplaceKeys = await this.getActiveMarketplaceKeys();
    const startTime = Date.now();

    const run = await p.stockProtectionRun.create({
      data: {
        xmlSourceId,
        xmlSourceName: xmlSourceName || null,
        triggerType,
        productCount: products.length,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // V3.1: ProductStockChanged event'i yayınla
    const productDetails = await Promise.all(
      products.slice(0, 100).map(async (p) => {
        const prod = await (prisma as any).product.findUnique({
          where: { id: p.productId },
          select: { sku: true, title: true, stock: true },
        });
        return {
          productId: p.productId,
          sku: prod?.sku || p.productId,
          productName: prod?.title || p.productId,
          oldStock: prod?.stock || 0,
          newStock: p.stock,
        };
      })
    );

    EventBus.emit({
      type: 'ProductStockChanged',
      correlationId,
      timestamp: new Date().toISOString(),
      source: 'StockProtectionEngine',
      data: {
        xmlSourceId,
        xmlSourceName,
        products: productDetails,
        totalProducts: products.length,
      },
    });

    const result = await this.batchCheck(products, marketplaceKeys, triggerType, correlationId);

    await p.stockProtectionRun.update({
      where: { id: run.id },
      data: {
        closedCount: result.closed,
        openedCount: result.opened,
        skipCount: result.skipped,
        errorCount: result.errors,
        successCount: result.totalActions - result.errors,
        status: result.errors > 0 ? 'PARTIAL' : 'SUCCESS',
        finishedAt: new Date(),
        durationMs: Date.now() - startTime,
      },
    });

    console.log(`[StockProtection] XML update complete: ${result.totalActions} actions [${correlationId}]`);

    return { processed: products.length, actions: [], runId: run.id };
  }

  // ==================== SCHEDULER LOCK ====================

  private _schedulerLock = false;
  private _schedulerQueue: Array<{ xmlSourceId: string; products: Array<{ productId: string; stock: number }>; triggerType: TriggerType }> = [];

  async enqueueXmlUpdate(
    xmlSourceId: string,
    products: Array<{ productId: string; stock: number }>,
    triggerType: TriggerType = 'XML_SCHEDULER'
  ): Promise<void> {
    if (this._schedulerLock) {
      this._schedulerQueue.push({ xmlSourceId, products, triggerType });
      console.log(`[StockProtection] Scheduler lock active, ${this._schedulerQueue.length} job(s) queued`);
      return;
    }

    this._schedulerLock = true;
    try {
      await this.processXmlStockUpdate(xmlSourceId, products, triggerType);
    } finally {
      this._schedulerLock = false;
    }

    if (this._schedulerQueue.length > 0) {
      const next = this._schedulerQueue.shift()!;
      await this.enqueueXmlUpdate(next.xmlSourceId, next.products, next.triggerType);
    }
  }

  // ==================== YARDIMCILAR ====================

  private async isProductExempt(productId: string): Promise<boolean> {
    const exemption = await p.stockProtectionExemption.findUnique({
      where: { productId },
    });
    return !!exemption;
  }

  async setExemption(productId: string, exempt: boolean, reason?: string): Promise<void> {
    if (exempt) {
      let productName: string | undefined;
      let sku: string | undefined;
      try {
        const prod = await p.product.findUnique({
          where: { id: productId },
          select: { title: true, sku: true },
        });
        productName = prod?.title || undefined;
        sku = prod?.sku || undefined;
      } catch { /* ignore */ }

      await p.stockProtectionExemption.upsert({
        where: { productId },
        update: { reason: reason || null, productName, sku },
        create: { productId, reason: reason || null, productName, sku },
      });
    } else {
      await p.stockProtectionExemption.delete({ where: { productId } }).catch(() => {});
    }
  }

  private async getActiveMarketplaceKeys(): Promise<string[]> {
    const mps = await p.marketplace.findMany({
      where: { active: true },
      select: { key: true },
    });
    return mps.map((m: any) => m.key);
  }

  private async logAction(action: StockAction): Promise<void> {
    await p.stockProtectionLog.create({
      data: {
        productId: action.productId,
        sku: action.sku,
        productName: action.productName,
        barcode: action.barcode || null,
        xmlSourceId: action.xmlSourceId || null,
        xmlSourceName: action.xmlSourceName || null,
        marketplaceKey: action.marketplaceKey,
        marketplaceName: action.marketplaceName || null,
        action: action.action,
        decision: action.decision,
        reason: action.reason,
        stockBefore: action.stockBefore,
        stockAfter: action.stockAfter,
        criticalLevel: action.criticalLevel,
        criticalLevelSource: action.criticalLevelSource || null,
        verifiedStock: action.verifiedStock ?? null,
        success: action.success,
        httpStatus: action.httpStatus || null,
        apiResponse: action.apiResponse || null,
        errorMessage: action.errorMessage || null,
        durationMs: action.durationMs,
        retryCount: action.retryCount,
        maxRetries: this.config.maxRetries,
        triggerType: action.triggerType,
      },
    });
  }

  // ==================== RAPORLAMA ====================

  async getStats(): Promise<{
    enabled: boolean;
    useGlobalCriticalStock: boolean;
    globalCriticalStock: number;
    isRunning: boolean;
    queueLength: number;
    totalClosed: number;
    totalOpened: number;
    totalErrors: number;
    lastRun: string | null;
    todayClosed: number;
    todayOpened: number;
    todayErrors: number;
    successRate: number;
    emergencyStop: boolean;
    verifyBeforeClose: boolean;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalClosed, totalOpened, totalErrors, todayClosed, todayOpened, todayErrors, lastRun] = await Promise.all([
      p.stockProtectionLog.count({ where: { action: 'CLOSED' } }),
      p.stockProtectionLog.count({ where: { action: 'OPENED' } }),
      p.stockProtectionLog.count({ where: { success: false } }),
      p.stockProtectionLog.count({ where: { action: 'CLOSED', createdAt: { gte: today } } }),
      p.stockProtectionLog.count({ where: { action: 'OPENED', createdAt: { gte: today } } }),
      p.stockProtectionLog.count({ where: { success: false, createdAt: { gte: today } } }),
      p.stockProtectionLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);

    const totalActions = totalClosed + totalOpened + totalErrors;
    const successRate = totalActions > 0 ? ((totalClosed + totalOpened) / totalActions) * 100 : 100;

    return {
      enabled: this.config.enabled,
      useGlobalCriticalStock: this.config.useGlobalCriticalStock,
      globalCriticalStock: this.config.globalCriticalStock,
      isRunning: this._isRunning || this._schedulerLock,
      queueLength: this._schedulerQueue.length,
      totalClosed,
      totalOpened,
      totalErrors,
      lastRun: lastRun?.createdAt?.toISOString() || null,
      todayClosed,
      todayOpened,
      todayErrors,
      successRate: Math.round(successRate * 10) / 10,
      emergencyStop: this._emergencyStop,
      verifyBeforeClose: this.config.verifyBeforeClose,
    };
  }

  async getLogs(limit = 50): Promise<any[]> {
    return p.stockProtectionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getRuns(limit = 20): Promise<any[]> {
    return p.stockProtectionRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getQueueStatus(): Promise<{ isRunning: boolean; queueLength: number }> {
    return {
      isRunning: this._isRunning || this._schedulerLock,
      queueLength: this._schedulerQueue.length,
    };
  }
}

// ==================== SINGLETON ====================

export const stockProtectionEngine = new StockProtectionEngine();
