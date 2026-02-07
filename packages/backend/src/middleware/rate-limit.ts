import type { Request, Response, NextFunction } from 'express';

// ── In-memory sliding-window rate limiter ──────────────────────────────
// Suitable for single-process pilot deployments (~100 restaurants, ~300 workers).
// For multi-process production, swap to Redis-backed counters.

interface WindowEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowEntry>();

// Evict expired entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now >= entry.resetAt) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref(); // unref so timer doesn't keep process alive

interface RateLimitOptions {
  /** Time window in seconds */
  windowSec: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Key extractor — defaults to IP address */
  keyFn?: (req: Request) => string;
}

const isProduction = process.env['NODE_ENV'] === 'production';

export function rateLimit(options: RateLimitOptions) {
  const { windowSec, maxRequests, keyFn } = options;
  const windowMs = windowSec * 1000;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isProduction) {
      next();
      return;
    }

    const key = keyFn ? keyFn(req) : (req.ip ?? req.socket.remoteAddress ?? 'unknown');
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count++;

    // Set standard rate-limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

// ── Pre-configured limiters ────────────────────────────────────────────

/** Auth endpoints: 10 requests per 15 minutes per IP */
export const authLimiter = rateLimit({ windowSec: 15 * 60, maxRequests: 10 });

/** Write operations (POST/PUT/DELETE): 60 requests per minute per IP */
export const writeLimiter = rateLimit({ windowSec: 60, maxRequests: 60 });

/** Read operations (GET): 200 requests per minute per IP */
export const readLimiter = rateLimit({ windowSec: 60, maxRequests: 200 });
