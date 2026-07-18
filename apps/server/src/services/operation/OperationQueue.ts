import type { Operation, OperationType, OperationStatus } from './types.ts';

type Priority = 'high' | 'normal' | 'low';

interface QueueItem {
  operation: Operation;
  priority: Priority;
  addedAt: Date;
}

export class OperationQueue {
  private queues: Map<Priority, QueueItem[]> = new Map();
  private processing = new Set<string>();
  private paused = false;
  private listeners: Array<(op: Operation) => void> = [];

  constructor() {
    this.queues.set('high', []);
    this.queues.set('normal', []);
    this.queues.set('low', []);
  }

  enqueue(operation: Operation, priority: Priority = 'normal'): void {
    const q = this.queues.get(priority)!;
    q.push({ operation, priority, addedAt: new Date() });
    this.notifyListeners(operation);
  }

  dequeue(): Operation | null {
    if (this.paused) return null;

    for (const p of ['high', 'normal', 'low'] as Priority[]) {
      const q = this.queues.get(p)!;
      if (q.length > 0) {
        const item = q.shift()!;
        this.processing.add(item.operation.id);
        return item.operation;
      }
    }
    return null;
  }

  complete(id: string): void {
    this.processing.delete(id);
  }

  fail(id: string): void {
    this.processing.delete(id);
  }

  get size(): number {
    return Array.from(this.queues.values()).reduce((sum, q) => sum + q.length, 0);
  }

  get processingCount(): number {
    return this.processing.size;
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  isPaused(): boolean { return this.paused; }

  onOperation(cb: (op: Operation) => void): void {
    this.listeners.push(cb);
  }

  private notifyListeners(op: Operation): void {
    for (const cb of this.listeners) cb(op);
  }

  getStats(): { queued: number; processing: number; paused: boolean } {
    return { queued: this.size, processing: this.processingCount, paused: this.paused };
  }
}
