// ==================== ÖNBELLEK V5.0 ====================
// DG STOK V5.0 - In-memory cache
// ========================================================

import type { ICache } from './interfaces.ts';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class Cache implements ICache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs = 5 * 60 * 1000; // 5 dakika

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const cache = new Cache();
