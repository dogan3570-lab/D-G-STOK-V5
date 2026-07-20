import { prisma } from '../db/prisma.ts';
import { fetchXmlFromUrl, importXmlProducts } from './xmlImport.ts';
import { StockProtectionEngine } from './stockProtection/StockProtectionEngine.ts';
import { WorkflowStateManager } from './workflow/WorkflowStateManager.ts';
import { EventBus } from './eventBus/EventBus.ts';
import { createCorrelationId } from './eventBus/events.ts';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Otomasyon kurallarını kontrol et ve zamanı gelenleri çalıştır
 */
async function checkAndRunRules() {
  if (isRunning) return;
  isRunning = true;

  try {
    const activeRules = await prisma.automationRule.findMany({
      where: { active: true },
    });

    for (const rule of activeRules) {
      try {
        // Son çalışma zamanını kontrol et
        const now = new Date();
        const lastRun = rule.lastRunAt ? new Date(rule.lastRunAt) : null;
        
        // Zamanlama kontrolü
        if (rule.schedule) {
          const intervalMinutes = parseInt(rule.schedule.replace('*/', '').replace(' * * * *', ''), 10);
          if (isNaN(intervalMinutes)) continue;

          if (lastRun) {
            const diffMs = now.getTime() - lastRun.getTime();
            const diffMinutes = diffMs / (1000 * 60);
            if (diffMinutes < intervalMinutes) continue;
          }
        }

        // Kuralı çalıştır
        await executeRule(rule);
      } catch (ruleError) {
        console.error(`[Scheduler] Rule "${rule.name}" error:`, ruleError);
        
        // Hatayı kaydet
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: {
            lastError: ruleError instanceof Error ? ruleError.message : 'Bilinmeyen hata',
            lastRunAt: new Date(),
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            action: 'AUTOMATION_RUN',
            entity: 'automation',
            entityId: rule.id,
            details: JSON.stringify({ 
              ruleName: rule.name, 
              type: rule.type, 
              error: ruleError instanceof Error ? ruleError.message : 'Bilinmeyen hata',
              success: false 
            }),
          },
        });
      }
    }
  } catch (error) {
    console.error('[Scheduler] Global error:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Bir otomasyon kuralını çalıştır
 */
async function executeRule(rule: any) {
  console.log(`[Scheduler] Executing rule: "${rule.name}" (${rule.type})`);

  let success = true;
  let errorMessage: string | null = null;

  try {
    switch (rule.actionType) {
      case 'sync_xml': {
        // XML kaynaklarını senkronize et
        const xmlSources = await prisma.xmlSource.findMany({
          where: { active: true },
        });

        for (const source of xmlSources) {
          if (!source.url) continue;
          
          // Son sync'in üzerinden yeterli süre geçti mi kontrol et
          const lastRun = source.lastRunAt ? new Date(source.lastRunAt).getTime() : 0;
          const now = Date.now();
          const minIntervalMs = (source.scheduleIntervalMinutes || 60) * 60 * 1000;
          
          if (lastRun > 0 && (now - lastRun) < minIntervalMs) {
            console.log(`[Scheduler] Skipping "${source.name}" - last sync was ${Math.round((now - lastRun) / 1000)}s ago (min ${source.scheduleIntervalMinutes}m)`);
            continue;
          }
          
          try {
            const xmlContent = await fetchXmlFromUrl(source.url);
            const result = await importXmlProducts(xmlContent, {
              sourceId: source.id,
              sourceName: source.name,
            });
            
            console.log(`[Scheduler] XML sync "${source.name}": ${result.importedCount} new, ${result.updatedCount} updated`);
          } catch (sourceError) {
            console.error(`[Scheduler] XML source "${source.name}" error:`, sourceError);
          }
        }
        break;
      }

      case 'update_price': {
        // Fiyat güncelleme - actionConfig'de belirtilen kuralları uygula
        const config = rule.actionConfig ? JSON.parse(rule.actionConfig) : {};
        const marketplaceId = config.marketplaceId || rule.marketplaceId;

        if (marketplaceId) {
          const states = await prisma.productMarketplaceState.findMany({
            where: { marketplaceId },
            include: { product: true },
          });

          for (const state of states) {
            if (state.product?.salePrice) {
              await prisma.productMarketplaceState.update({
                where: { id: state.id },
                data: { price: state.product.salePrice },
              });
            }
          }
        }
        break;
      }

      case 'stock_protection': {
        // ================================================================
        // OTOMATİK STOK KORUMA TARAMASI
        // Tüm ürünleri tara, stok < minStock olanları pazaryerinde kapat
        // ================================================================
        const engine = new StockProtectionEngine();
        const scanStart = Date.now();
        
        // Düşük stoklu ürünleri bul
        const lowStockProducts = await prisma.product.findMany({
          where: {
            stock: { lte: 5 },
          },
          select: { id: true, sku: true, stock: true, minStock: true, title: true, salePrice: true },
          take: 500,
        });

        let closed = 0, opened = 0, errors = 0;
        
        for (const product of lowStockProducts) {
          const criticalLevel = product.minStock || 5;
          const isCritical = (product.stock ?? 0) <= criticalLevel;
          
          try {
            // Tüm pazaryeri durumlarını kontrol et
            const mpStates = await prisma.productMarketplaceState.findMany({
              where: { productId: product.id },
              include: { marketplace: { select: { key: true, name: true } } },
            });

            for (const mpState of mpStates) {
              const decision = isCritical ? 'CLOSE' : 'OPEN';
              
              if (isCritical && mpState.status !== 'CLOSED') {
                // Kapat
                await prisma.productMarketplaceState.update({
                  where: { id: mpState.id },
                  data: { status: 'CLOSED', lastActionAt: new Date() },
                });
                closed++;
                
                (EventBus.emit as any)({
                  type: 'StockProtectionDecision',
                  correlationId: createCorrelationId('API'),
                  timestamp: new Date().toISOString(),
                  source: 'StockProtectionScanner',
                  data: {
                    productId: product.id,
                    productName: product.title || product.sku || 'Unknown',
                    marketplaceKey: mpState.marketplace?.key || 'unknown',
                    marketplaceName: mpState.marketplace?.name || 'Unknown',
                    decision: 'CLOSE',
                    currentStock: product.stock ?? 0,
                    criticalLevel,
                    success: true,
                  },
                });
                
                await WorkflowStateManager.recordTimeline(
                  product.id,
                  `🟢 Stok koruma: ${mpState.marketplace?.name || 'Pazaryeri'} ilanı kapatıldı (stok:${product.stock})`,
                  { decision: 'CLOSE', criticalLevel }
                );
                
              } else if (!isCritical && mpState.status === 'CLOSED') {
                // Aç
                await prisma.productMarketplaceState.update({
                  where: { id: mpState.id },
                  data: { status: 'ACTIVE', lastActionAt: new Date() },
                });
                opened++;
                
                (EventBus.emit as any)({
                  type: 'StockProtectionDecision',
                  correlationId: createCorrelationId('API'),
                  timestamp: new Date().toISOString(),
                  source: 'StockProtectionScanner',
                  data: {
                    productId: product.id,
                    productName: product.title || product.sku || 'Unknown',
                    marketplaceKey: mpState.marketplace?.key || 'unknown',
                    marketplaceName: mpState.marketplace?.name || 'Unknown',
                    decision: 'OPEN',
                    currentStock: product.stock ?? 0,
                    criticalLevel,
                    success: true,
                  },
                });
                
                await WorkflowStateManager.recordTimeline(
                  product.id,
                  `🟢 Stok koruma: ${mpState.marketplace?.name || 'Pazaryeri'} ilanı açıldı (stok:${product.stock})`,
                  { decision: 'OPEN', criticalLevel }
                );
              }
            }
          } catch (e) {
            errors++;
            console.error(`[StockProtection] Error for product ${product.id}:`, e);
          }
        }
        
        console.log(`[StockProtection] Scan complete: ${closed} closed, ${opened} opened, ${errors} errors in ${Date.now() - scanStart}ms`);
        
        // Dashboard'u güncelle
        EventBus.emit({
          type: 'DashboardRefresh',
          correlationId: createCorrelationId('API'),
          timestamp: new Date().toISOString(),
          source: 'StockProtectionScanner',
          data: { reason: 'stock_protection_scan', affectedModules: ['StockProtection', 'Marketplace'] },
        });
        
        break;
      }

      case 'update_stock': {
        // Stok güncelleme
        const config = rule.actionConfig ? JSON.parse(rule.actionConfig) : {};
        const marketplaceId = config.marketplaceId || rule.marketplaceId;

        if (marketplaceId) {
          const states = await prisma.productMarketplaceState.findMany({
            where: { marketplaceId },
            include: { product: true },
          });

          for (const state of states) {
            if (state.product?.stock !== undefined) {
              await prisma.productMarketplaceState.update({
                where: { id: state.id },
                data: { stock: state.product.stock },
              });
            }
          }
        }
        break;
      }

      case 'sync_order': {
        // Sipariş senkronizasyonu (pazaryeri API'lerinden)
        console.log(`[Scheduler] Order sync for rule "${rule.name}"`);
        break;
      }

      case 'send_notification': {
        // Bildirim gönderme
        const config = rule.actionConfig ? JSON.parse(rule.actionConfig) : {};
        const notificationType = config.notificationType || 'info';
        const notificationTitle = config.title || 'Otomasyon Bildirimi';
        const notificationMessage = config.message || `"${rule.name}" kuralı çalıştırıldı`;

        await prisma.notification.create({
          data: {
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
          },
        });
        break;
      }

      default:
        console.log(`[Scheduler] Unknown action type: ${rule.actionType}`);
    }
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error(`[Scheduler] Rule execution error:`, error);
  }

  // Kuralın son çalışma durumunu güncelle
  await prisma.automationRule.update({
    where: { id: rule.id },
    data: {
      lastRunAt: new Date(),
      lastSuccessAt: success ? new Date() : undefined,
      lastError: errorMessage,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'AUTOMATION_RUN',
      entity: 'automation',
      entityId: rule.id,
      details: JSON.stringify({ 
        ruleName: rule.name, 
        type: rule.type, 
        actionType: rule.actionType,
        success,
        error: errorMessage,
      }),
    },
  });

  return { success, error: errorMessage };
}

/**
 * Scheduler'ı başlat
 */
export function startScheduler(intervalSeconds: number = 30) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  console.log(`[Scheduler] Starting automation scheduler (check every ${intervalSeconds}s)`);
  
  // İlk çalıştırma
  checkAndRunRules();

  // Periyodik kontrol
  schedulerInterval = setInterval(checkAndRunRules, intervalSeconds * 1000);
}

/**
 * Scheduler'ı durdur
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Stopped');
  }
}

/**
 * Belirli bir kuralı manuel çalıştır (API'den çağrılır)
 */
export async function runRuleManually(ruleId: string) {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule) {
    throw new Error('Kural bulunamadı');
  }

  return await executeRule(rule);
}
