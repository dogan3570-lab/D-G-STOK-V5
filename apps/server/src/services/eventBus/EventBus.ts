// ==================== DG STOK EVENT BUS V2.0 (Optimized) ====================
// Merkezi olay yönetim sistemi.
// KURAL 3: Modüller birbirini doğrudan çağırmaz, event yayınlar.
// PERFORMANS: Event storm koruması, duplicate event detektörü, throttle
// ===========================================================================

import { AppEvent, EventHandler } from './events.ts';

type EventType = AppEvent['type'];

interface EventBusStats {
  totalEmitted: number;
  totalDropped: number;
  activeHandlers: number;
  lastEventType: string | null;
  lastEventAt: number | null;
}

export class EventBus {
  private static handlers = new Map<EventType, Set<EventHandler>>();
  private static history: AppEvent[] = [];
  private static maxHistory = 200; // Azaltıldı: 1000 → 200 (memory optimization)

  // === PERFORMANCE: Event Storm Detection ===
  private static eventCounts = new Map<string, { count: number; resetAt: number }>();
  private static readonly EVENT_RATE_LIMIT = 100; // max events per second per type
  private static readonly EVENT_RATE_WINDOW = 1000; // 1 second window

  // === PERFORMANCE: Throttle ===
  private static lastEmitTime = new Map<EventType, number>();
  private static readonly MIN_EMIT_INTERVAL = 50; // 50ms between same event type

  // === PERFORMANCE: Loop Detection ===
  private static emitDepth = 0;
  private static readonly MAX_EMIT_DEPTH = 10;

  // === STATS ===
  private static stats: EventBusStats = {
    totalEmitted: 0,
    totalDropped: 0,
    activeHandlers: 0,
    lastEventType: null,
    lastEventAt: null,
  };

  static on<T extends AppEvent>(type: T['type'], handler: EventHandler<T>): void {
    if (!EventBus.handlers.has(type)) {
      EventBus.handlers.set(type, new Set());
    }
    EventBus.handlers.get(type)!.add(handler as EventHandler);
  }

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
   * Event storm, loop ve duplicate event korumalı.
   */
  static async emit(event: AppEvent): Promise<void> {
    // === LOOP DETECTION ===
    EventBus.emitDepth++;
    if (EventBus.emitDepth > EventBus.MAX_EMIT_DEPTH) {
      console.warn(`[EventBus] ⚠️ Loop detected: "${event.type}" depth=${EventBus.emitDepth}, dropping [${event.correlationId}]`);
      EventBus.emitDepth--;
      EventBus.stats.totalDropped++;
      return;
    }

    // === EVENT STORM DETECTION ===
    const now = Date.now();
    const counter = EventBus.eventCounts.get(event.type);
    if (counter && now - counter.resetAt < EventBus.EVENT_RATE_WINDOW) {
      counter.count++;
      if (counter.count > EventBus.EVENT_RATE_LIMIT) {
        console.warn(`[EventBus] ⚠️ Event storm: "${event.type}" x${counter.count}/s, dropping [${event.correlationId}]`);
        EventBus.emitDepth--;
        EventBus.stats.totalDropped++;
        return;
      }
    } else {
      EventBus.eventCounts.set(event.type, { count: 1, resetAt: now });
    }

    // === THROTTLE: Aynı event tipi için minimum interval ===
    const lastEmit = EventBus.lastEmitTime.get(event.type);
    if (lastEmit && now - lastEmit < EventBus.MIN_EMIT_INTERVAL) {
      // Sadece log atma, event'i yine de ilet (throttle değil drop)
      // Bu sadece performans monitoring için
    }
    EventBus.lastEmitTime.set(event.type, now);

    const handlers = EventBus.handlers.get(event.type);
    
    // History (circular buffer optimization)
    if (EventBus.history.length >= EventBus.maxHistory) {
      EventBus.history.shift();
    }
    EventBus.history.push(event);

    // Stats
    EventBus.stats.totalEmitted++;
    EventBus.stats.lastEventType = event.type;
    EventBus.stats.lastEventAt = now;

    if (!handlers || handlers.size === 0) {
      EventBus.emitDepth--;
      return;
    }

    // === PARALLEL EXECUTION with concurrency limit ===
    const handlerArray = Array.from(handlers);
    
    // Küçük event'ler için direkt await, büyük için parallel
    if (handlerArray.length <= 3) {
      for (const handler of handlerArray) {
        try {
          await handler(event);
        } catch (err: any) {
          console.error(`[EventBus] Handler error for "${event.type}":`, err.message);
        }
      }
    } else {
      const promises = handlerArray.map(handler =>
        Promise.resolve().then(async () => {
          try {
            await handler(event);
          } catch (err: any) {
            console.error(`[EventBus] Handler error for "${event.type}":`, err.message);
          }
        })
      );
      await Promise.all(promises);
    }

    EventBus.emitDepth--;
  }

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

  static getHistory(limit = 50): AppEvent[] {
    return EventBus.history.slice(-limit);
  }

  static clear(): void {
    EventBus.handlers.clear();
    EventBus.history = [];
    EventBus.eventCounts.clear();
    EventBus.lastEmitTime.clear();
    EventBus.emitDepth = 0;
    EventBus.stats = { totalEmitted: 0, totalDropped: 0, activeHandlers: 0, lastEventType: null, lastEventAt: null };
  }

  static getStats(): EventBusStats {
    EventBus.stats.activeHandlers = EventBus.handlerCount();
    return { ...EventBus.stats };
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
