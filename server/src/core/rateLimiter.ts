export interface RateLimitOptions {
  /** Sustained requests allowed per minute (token-bucket capacity + refill). */
  perMinute: number;
  /** Optional hard daily cap (UTC-day), for providers like API-Football (100/day). */
  perDay?: number;
}

/**
 * Token-bucket limiter with an optional per-UTC-day cap. A hard backstop: even
 * if the poller misbehaves, upstream calls can never exceed the configured caps.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill = Date.now();
  private dayCount = 0;
  private dayStamp = RateLimiter.utcDay();

  constructor(private readonly opts: RateLimitOptions) {
    this.tokens = opts.perMinute;
  }

  private static utcDay(): number {
    return Math.floor(Date.now() / 86_400_000);
  }

  private refill(): void {
    const now = Date.now();
    const gained = ((now - this.lastRefill) / 60_000) * this.opts.perMinute;
    if (gained > 0) {
      this.tokens = Math.min(this.opts.perMinute, this.tokens + gained);
      this.lastRefill = now;
    }
    const today = RateLimiter.utcDay();
    if (today !== this.dayStamp) {
      this.dayStamp = today;
      this.dayCount = 0;
    }
  }

  /** Consume one token if available (and under the daily cap). */
  tryAcquire(): boolean {
    this.refill();
    if (this.opts.perDay !== undefined && this.dayCount >= this.opts.perDay) return false;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    this.dayCount += 1;
    return true;
  }

  get remainingToday(): number | undefined {
    return this.opts.perDay === undefined ? undefined : Math.max(0, this.opts.perDay - this.dayCount);
  }
}
