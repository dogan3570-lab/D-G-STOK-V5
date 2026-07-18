// ==================== MARKETPLACE SDK - RATE LİMİTER V1.0 ====================
// Token Bucket + Sliding Window algoritmaları ile rate limit koruması.
// HTTP 429 desteği, Retry-After başlığı.
// =============================================================================

/**
 * Rate Limiter - Token Bucket algoritması
 * 
 * Kullanım:
 * ```typescript
 * const limiter = new MarketplaceRateLimiter({ maxPerSecond: 10 });
 * await limiter.acquire('trendyol');
 * // API isteği yap
 * ```
 */
export class MarketplaceRateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private windows = new Map<string, SlidingWindow>();
  private readonly maxPerSecond: number;
  private readonly maxBurst: number;

  constructor(options: { maxPerSecond: number; maxBurst?: number }) {
    this.maxPerSecond = options.maxPerSecond;
    this.maxBurst = options.maxBurst || options.maxPerSecond * 2;
  }

  /**
   * İstek yapmadan önce token al.
   * Token yoksa bekle.
   */
  async acquire(key: string): Promise<void> {
    const bucket = this.getOrCreateBucket(key);
    await bucket.acquire();
  }

  /**
   * HTTP 429 sonrası rate limit sıfırlama.
   * Retry-After süresi kadar bekleme zorunluluğu.
   */
  handleRateLimit(key: string, retryAfterSeconds: number): void {
    const bucket = this.getOrCreateBucket(key);
    bucket.reset(retryAfterSeconds);
  }

  /**
   * Mevcut durumu raporla.
   */
  getStatus(key: string): { tokens: number; maxTokens: number; isLimited: boolean } {
    const bucket = this.buckets.get(key);
    if (!bucket) return { tokens: this.maxBurst, maxTokens: this.maxBurst, isLimited: false };
    return {
      tokens: bucket.tokens,
      maxTokens: bucket.maxTokens,
      isLimited: bucket.tokens === 0,
    };
  }

  private getOrCreateBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.maxPerSecond, this.maxBurst);
      this.buckets.set(key, bucket);
    }
    return bucket;
  }
}

/** Token Bucket algoritması */
class TokenBucket {
  public tokens: number;
  public maxTokens: number;
  private refillRate: number;
  private lastRefill: number;
  private forcedWaitUntil: number = 0;

  constructor(refillPerSecond: number, maxBurst: number) {
    this.tokens = maxBurst;
    this.maxTokens = maxBurst;
    this.refillRate = refillPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    // Forced wait (429 sonrası)
    if (this.forcedWaitUntil > Date.now()) {
      const waitTime = this.forcedWaitUntil - Date.now();
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.forcedWaitUntil = 0;
      this.refill();
    }

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Token yok, bekle
    const waitTime = (1000 / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
    }
  }

  reset(retryAfterSeconds: number): void {
    this.tokens = 0;
    this.forcedWaitUntil = Date.now() + (retryAfterSeconds * 1000);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsed * this.refillRate);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}

/** Sliding Window log algoritması (opsiyonel - daha hassas) */
class SlidingWindow {
  private windowSizeMs: number;
  private maxRequests: number;
  private timestamps: number[] = [];

  constructor(windowSizeMs: number, maxRequests: number) {
    this.windowSizeMs = windowSizeMs;
    this.maxRequests = maxRequests;
  }

  async acquire(): Promise<void> {
    this.slide();

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(Date.now());
      return;
    }

    // En eski isteğin üzerinden window kadar süre geçmesini bekle
    const oldest = this.timestamps[0];
    const waitTime = oldest + this.windowSizeMs - Date.now();
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.slide();
    this.timestamps.push(Date.now());
  }

  private slide(): void {
    const cutoff = Date.now() - this.windowSizeMs;
    this.timestamps = this.timestamps.filter(t => t > cutoff);
  }
}
