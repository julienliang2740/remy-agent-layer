/**
 * Minimal sliding-window rate limiter for the public endpoints (/detect and
 * /recipe call paid vision/LLM APIs — this is the cost fuse). In-memory by
 * design: the MVP runs as a single Node process. The clock is injectable so
 * tests don't sleep.
 */
export interface RateLimiterOptions {
  /** Max requests allowed per window per key (default 20). */
  limit?: number;
  /** Window length in ms (default 60_000). */
  windowMs?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
}

export interface RateLimiter {
  /** Returns true if the request is allowed, false if rate-limited. */
  allow(key: string): boolean;
  /** Seconds until the oldest request in the window expires (for Retry-After). */
  retryAfterSecs(key: string): number;
}

export function createRateLimiter(opts: RateLimiterOptions = {}): RateLimiter {
  const limit = opts.limit ?? 20;
  const windowMs = opts.windowMs ?? 60_000;
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();

  function prune(key: string): number[] {
    const cutoff = now() - windowMs;
    const kept = (hits.get(key) ?? []).filter((t) => t > cutoff);
    hits.set(key, kept);
    return kept;
  }

  return {
    allow(key: string): boolean {
      const kept = prune(key);
      if (kept.length >= limit) return false;
      kept.push(now());
      return true;
    },
    retryAfterSecs(key: string): number {
      const kept = prune(key);
      if (kept.length === 0) return 0;
      return Math.max(1, Math.ceil((kept[0]! + windowMs - now()) / 1000));
    },
  };
}
