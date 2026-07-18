// ==================== MARKETPLACE SDK - KUYRUK V1.0 ====================
// Öncelikli kuyruk (HIGH/NORMAL/LOW), max concurrent, pause/resume, retry
// =======================================================================

import { CorrelationId } from '../../eventBus/events.ts';
import { RequestPriority } from './MarketplaceTypes.ts';

interface QueueTask<T = any> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  priority: number;
  correlationId: CorrelationId;
  operation: string;
  marketplaceKey: string;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
}

/**
 * Öncelikli kuyruk yöneticisi.
 * 
 * Özellikler:
 * - HIGH / NORMAL / LOW öncelik
 * - Max concurrent limiti
 * - Pause / Resume
 * - Retry (her task için ayrı maxRetries)
 * - EventBus entegrasyonu
 */
export class MarketplaceQueue {
  private queue: QueueTask[] = [];
  private activeCount = 0;
  private maxConcurrent: number;
  private paused = false;
  private taskIdCounter = 0;
  private readonly PRIORITY_MAP: Record<RequestPriority, number> = {
    HIGH: 100,
    NORMAL: 0,
    LOW: -100,
  };

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Kuyruğa task ekle.
   * Priority: HIGH=100, NORMAL=0, LOW=-100
   */
  async enqueue<T>(
    marketplaceKey: string,
    operation: string,
    fn: () => Promise<T>,
    options: {
      priority?: RequestPriority;
      correlationId: CorrelationId;
      maxRetries?: number;
    }
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const taskId = `task-${++this.taskIdCounter}-${Date.now()}`;
      const task: QueueTask<T> = {
        id: taskId,
        execute: fn,
        resolve,
        reject,
        priority: this.PRIORITY_MAP[options.priority || 'NORMAL'],
        correlationId: options.correlationId,
        operation,
        marketplaceKey,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: options.maxRetries ?? 0,
      };

      this.queue.push(task);
      this.queue.sort((a, b) => b.priority - a.priority);
      this.processNext();
    });
  }

  /** Kuyruğu duraklat */
  pause(): void {
    this.paused = true;
  }

  /** Kuyruğu devam ettir */
  resume(): void {
    this.paused = false;
    this.processNext();
  }

  get isPaused(): boolean { return this.paused; }
  get length(): number { return this.queue.length; }
  get active(): number { return this.activeCount; }

  /**
   * Kuyruk istatistikleri
   */
  getStats(): {
    pending: number;
    active: number;
    highPriority: number;
    normalPriority: number;
    lowPriority: number;
    isPaused: boolean;
  } {
    return {
      pending: this.queue.length,
      active: this.activeCount,
      highPriority: this.queue.filter(t => t.priority > 0).length,
      normalPriority: this.queue.filter(t => t.priority === 0).length,
      lowPriority: this.queue.filter(t => t.priority < 0).length,
      isPaused: this.paused,
    };
  }

  private processNext(): void {
    if (this.paused) return;
    if (this.activeCount >= this.maxConcurrent) return;
    if (this.queue.length === 0) return;

    const task = this.queue.shift()!;
    this.activeCount++;

    const executeTask = () => {
      task.execute()
        .then((result) => {
          task.resolve(result);
          this.activeCount--;
          this.processNext();
        })
        .catch(async (error) => {
          if (task.retryCount < task.maxRetries) {
            task.retryCount++;
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, task.retryCount - 1), 30000);
            console.log(
              `[MarketplaceQueue] 🔄 Retry ${task.retryCount}/${task.maxRetries} ` +
              `${task.marketplaceKey}.${task.operation} after ${delay}ms ` +
              `[${task.correlationId}]`
            );
            await new Promise(r => setTimeout(r, delay));
            this.queue.unshift(task);
            this.queue.sort((a, b) => b.priority - a.priority);
          } else {
            task.reject(error);
          }
          this.activeCount--;
          this.processNext();
        });
    };

    executeTask();
  }
}
