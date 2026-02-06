/**
 * Simple in-memory rate limiter for API endpoints
 * Uses sliding window algorithm
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > 60000) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // New entry or window expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetMs: config.windowMs,
    };
  }

  // Within window
  const timeLeft = config.windowMs - (now - entry.windowStart);

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: timeLeft,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetMs: timeLeft,
  };
}

/**
 * Rate limit presets for common use cases
 */
export const RateLimitPresets = {
  /** Standard API: 100 requests per minute */
  standard: { maxRequests: 100, windowMs: 60000 },

  /** Strict API: 20 requests per minute (for sensitive operations) */
  strict: { maxRequests: 20, windowMs: 60000 },

  /** Auth endpoints: 10 attempts per 5 minutes */
  auth: { maxRequests: 10, windowMs: 300000 },

  /** SMS/Email sending: 5 per minute per phone/email */
  notifications: { maxRequests: 5, windowMs: 60000 },

  /** Webhooks: 200 per minute */
  webhooks: { maxRequests: 200, windowMs: 60000 },
} as const;

/**
 * Create a rate limit key from request info
 */
export function createRateLimitKey(
  identifier: string,
  endpoint: string
): string {
  return `${identifier}:${endpoint}`;
}
