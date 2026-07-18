import type { Operation } from './types.ts';

export class RetryManager {
  private maxRetries = 3;
  private baseDelay = 1000; // 1sn

  shouldRetry(operation: Operation): boolean {
    return operation.retryCount < this.maxRetries;
  }

  getDelay(retryCount: number): number {
    // Exponential backoff: 1sn, 2sn, 4sn
    return this.baseDelay * Math.pow(2, retryCount - 1);
  }

  setMaxRetries(count: number): void {
    this.maxRetries = count;
  }
}
