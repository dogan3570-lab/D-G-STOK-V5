// ==================== DG STOK EVENT BUS V1.0 ====================
// Merkezi olay yönetim sistemi.
// KURAL 3: Modüller birbirini doğrudan çağırmaz, event yayınlar.
// ===============================================================

import { AppEvent, EventHandler } from './events.ts';

type EventType = AppEvent['type'];

/**
 * Event Bus - Merkezi olay dağıtım sistemi
 * 
 * Kullanım:
 * ```typescript
 * // Event dinle
 * EventBus.on('StockProtectionDecision', async (event) => {
 *   console.log('Karar:', event.data.decision);
 * });
 * 
 * // Event yayınla
 * EventBus.emit({
 *   type: 'StockProtectionDecision',
 *   correlationId: 'SP-20260715-000001',
 *   timestamp: new Date().toISOString(),
 *   source: 'StockProtectionEngine',
 *   data: { ... }
 * });
 * ```
 */
export class EventBus {
  private static handlers = new Map<EventType, Set<EventHandler>>();
  private static history: AppEvent[] = [];
  private static maxHistory = 1000;

  /**
   * Bir event tipine abone ol.
   * Aynı handler birden fazla kez eklenemez.
   */
  static on<T extends AppEvent>(type: T['type'], handler: EventHandler<T>): void {
    if (!EventBus.handlers.has(type)) {
      EventBus.handlers.set(type, new Set());
    }
    EventBus.handlers.get(type)!.add(handler as EventHandler);
    console.log(`[EventBus] Handler registered for "${type}"`);
  }

  /**
   * Aboneliği iptal et.
   */
  static off<T extends AppEvent>(type: T['type'], handler: EventHandler<T>): void {
    const handlers = EventBus.handlers.get(type);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        EventBus.handlers.delete(type);
      }
    }
  }

  /**
   * Bir event yayınla.
   * Tüm abonelere async olarak bildirilir.
   * Bir handler hata atsa bile diğerleri çalışmaya devam eder.
   */
  static async emit(event: AppEvent): Promise<void> {
    const handlers = EventBus.handlers.get(event.type);
    
    // History'ye ekle
    EventBus.history.push(event);
    if (EventBus.history.length > EventBus.maxHistory) {
      EventBus.history.shift();
    }

    if (!handlers || handlers.size === 0) {
      return;
    }

    console.log(`[EventBus] Emitting "${event.type}" to ${handlers.size} handler(s) [${event.correlationId}]`);

    const promises: Promise<void>[] = [];
    for (const handler of handlers) {
      promises.push(
        Promise.resolve().then(async () => {
          try {
            await handler(event);
          } catch (err: any) {
            console.error(`[EventBus] Handler error for "${event.type}":`, err.message);
          }
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Belirli bir tipteki event'lere abone olan handler sayısını döndürür.
   */
  static handlerCount(type?: EventType): number {
    if (type) {
      return EventBus.handlers.get(type)?.size || 0;
    }
    let count = 0;
    for (const handlers of EventBus.handlers.values()) {
      count += handlers.size;
    }
    return count;
  }

  /**
   * Event geçmişini döndürür.
   */
  static getHistory(limit = 50): AppEvent[] {
    return EventBus.history.slice(-limit);
  }

  /**
   * Tüm abonelikleri temizler (test için).
   */
  static clear(): void {
    EventBus.handlers.clear();
    EventBus.history = [];
  }
}

// ==================== DEFAULT LOG HANDLER ====================
// Tüm event'leri konsola log'lar

EventBus.on('ProductStockChanged', (event: any) => {
  const d = event.data;
  console.log(
    `[EventBus][ProductStockChanged] ${d.totalProducts} products ` +
    `from "${d.xmlSourceName || d.xmlSourceId}" ` +
    `[${event.correlationId}]`
  );
});

EventBus.on('StockProtectionDecision', (event: any) => {
  const d = event.data;
  const emoji = d.decision === 'CLOSE' ? '🔴' : d.decision === 'OPEN' ? '🟢' : '⏭️';
  console.log(
    `${emoji} [EventBus][StockProtectionDecision] ${d.productName} ` +
    `→ ${d.decision} on ${d.marketplaceName || d.marketplaceKey} ` +
    `(stock:${d.currentStock}, critical:${d.criticalLevel}) ` +
    `[${event.correlationId}]`
  );
});

EventBus.on('MarketplaceResponse', (event: any) => {
  const d = event.data;
  const icon = d.success ? '✅' : '❌';
  console.log(
    `${icon} [EventBus][MarketplaceResponse] ${d.marketplaceKey}.${d.operation} ` +
    `for SKU ${d.sku} => ${d.success ? 'OK' : 'FAIL'} ` +
    `(${d.durationMs}ms, http:${d.httpStatus}) ` +
    `[${event.correlationId}]`
  );
});

EventBus.on('EmergencyStop', (event: any) => {
  console.log(
    `🟥 [EventBus][EmergencyStop] Emergency stop ${event.data.active ? 'ACTIVATED' : 'DEACTIVATED'} ` +
    `[${event.correlationId}]`
  );
});
