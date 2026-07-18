import type { Operation, OperationEvent } from './types.ts';

type EventHandler = (op: Operation) => void;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  /** Singleton instance */
  private static _instance: EventBus;

  /**
   * Singleton instance döndürür.
   * Tüm modüller aynı EventBus'ı kullanır.
   */
  static getInstance(): EventBus {
    if (!EventBus._instance) {
      EventBus._instance = new EventBus();
    }
    return EventBus._instance;
  }

  on(event: string, handler: EventHandler): void {
    const existing = this.handlers.get(event) || [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  emit(event: string, operation: Operation): void {
    const handlers = this.handlers.get(event) || [];
    for (const h of handlers) {
      try { h(operation); } catch {}
    }
  }

  off(event: string, handler: EventHandler): void {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(event, existing.filter(h => h !== handler));
  }

  removeAll(): void {
    this.handlers.clear();
  }
}
