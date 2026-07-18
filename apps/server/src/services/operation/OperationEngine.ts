import { OperationQueue } from './OperationQueue.ts';
import { RetryManager } from './RetryManager.ts';
import { EventBus } from './EventBus.ts';
import type { Operation, OperationType, OperationStats } from './types.ts';
import { v4 as uuid } from 'uuid';

export class OperationEngine {
  readonly queue: OperationQueue;
  readonly retry: RetryManager;
  readonly events: EventBus;
  private workers: number;
  private active = false;
  private stats: OperationStats = { total: 0, queued: 0, processing: 0, completed: 0, failed: 0, retrying: 0, progress: 0, eta: 0, speed: 0 };

  constructor(workers = 3) {
    this.workers = workers;
    this.queue = new OperationQueue();
    this.retry = new RetryManager();
    this.events = new EventBus();
    this.setupListeners();
  }

  private setupListeners(): void {
    this.queue.onOperation((op) => {
      this.stats.total++;
      this.stats.queued = this.queue.size;
    });
  }

  async start(): Promise<void> {
    this.active = true;
    const workerPromises = [];
    for (let i = 0; i < this.workers; i++) {
      workerPromises.push(this.runWorker(i));
    }
    await Promise.all(workerPromises);
  }

  stop(): void {
    this.active = false;
    this.queue.pause();
  }

  resume(): void {
    this.queue.resume();
    if (!this.active) {
      this.active = true;
      this.start();
    }
  }

  pause(): void {
    this.queue.pause();
  }

  private async runWorker(id: number): Promise<void> {
    while (this.active) {
      const operation = this.queue.dequeue();
      if (!operation) {
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      try {
        this.events.emit('started', operation);
        operation.status = 'processing';
        operation.startedAt = new Date();

        // Islemi gerceklestir
        await this.processOperation(operation);

        operation.status = 'completed';
        operation.completedAt = new Date();
        this.stats.completed++;
        this.events.emit('completed', operation);
      } catch (error: any) {
        operation.error = error.message;
        
        if (this.retry.shouldRetry(operation)) {
          operation.status = 'retrying';
          operation.retryCount++;
          const delay = this.retry.getDelay(operation.retryCount);
          this.events.emit('retrying', operation);
          
          setTimeout(() => {
            this.queue.enqueue(operation, 'high');
          }, delay);
        } else {
          operation.status = 'failed';
          this.stats.failed++;
          this.events.emit('failed', operation);
        }
      } finally {
        this.queue.complete(operation.id);
        this.updateStats();
      }
    }
  }

  private async processOperation(operation: Operation): Promise<void> {
    const chunkSize = 100;
    for (let i = 0; i < operation.productIds.length; i += chunkSize) {
      const chunk = operation.productIds.slice(i, i + chunkSize);
      await this.executeChunk(operation.type, operation.marketplaceKey, chunk);
      operation.processedCount += chunk.length;
      operation.progress = Math.round((operation.processedCount / operation.totalCount) * 100);
      this.events.emit('progress', operation);
    }
  }

  private async executeChunk(type: OperationType, marketplaceKey: string, productIds: string[]): Promise<void> {
    // Gercek API cagrisi burada yapilacak
    // Su an bos implementasyon
    await new Promise(r => setTimeout(r, 10));
  }

  private updateStats(): void {
    const total = this.stats.total || 1;
    this.stats.queued = this.queue.size;
    this.stats.processing = this.queue.processingCount;
    this.stats.progress = Math.round(((this.stats.completed + this.stats.failed) / total) * 100);
  }

  enqueue(type: OperationType, marketplaceKey: string, productIds: string[], priority: 'high' | 'normal' | 'low' = 'normal'): Operation {
    const op: Operation = {
      id: uuid(),
      type,
      marketplaceKey,
      productIds,
      priority: priority === 'high' ? 1 : priority === 'normal' ? 2 : 3,
      status: 'queued',
      progress: 0,
      totalCount: productIds.length,
      processedCount: 0,
      failedCount: 0,
      retryCount: 0,
      maxRetries: 3,
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.queue.enqueue(op, priority);
    return op;
  }

  getStats(): OperationStats {
    return { ...this.stats };
  }
}
