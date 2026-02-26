/**
 * Rate limiting middleware for Hono
 */

import { Context, Next } from "hono";
import {
  checkRateLimit,
  createRateLimitKey,
  RateLimitConfig,
  RateLimitPresets,
} from "../lib/rate-limiter";

/**
 * Get client identifier from request
 * Uses the connecting IP from the socket when available.
 * Only trusts X-Forwarded-For when running behind a known reverse proxy
 * (configured via TRUST_PROXY env var).
 */
function getClientId(c: Context): string {
  // Only trust X-Forwarded-For if explicitly configured (e.g., behind nginx/cloudflare)
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
  }

  // Use CF-Connecting-IP if behind Cloudflare (harder to spoof)
  const cfIp = c.req.header("cf-connecting-ip");
  if (cfIp) {
    return cfIp;
  }

  // Fallback — less reliable but can't be spoofed via headers
  return c.req.header("x-real-ip") || "unknown-client";
}

/**
 * Create rate limit middleware
 */
export function rateLimit(config: RateLimitConfig = RateLimitPresets.standard) {
  return async (c: Context, next: Next) => {
    const clientId = getClientId(c);
    const endpoint = c.req.path;
    const key = createRateLimitKey(clientId, endpoint);

    const result = checkRateLimit(key, config);

    // Set rate limit headers
    c.header("X-RateLimit-Limit", config.maxRequests.toString());
    c.header("X-RateLimit-Remaining", result.remaining.toString());
    c.header(
      "X-RateLimit-Reset",
      Math.ceil((Date.now() + result.resetMs) / 1000).toString()
    );

    if (!result.allowed) {
      c.header("Retry-After", Math.ceil(result.resetMs / 1000).toString());
      return c.json(
        {
          error: "Too many requests",
          retryAfter: Math.ceil(result.resetMs / 1000),
        },
        429
      );
    }

    await next();
  };
}

/**
 * Pre-configured rate limit middlewares
 */
export const rateLimitStandard = rateLimit(RateLimitPresets.standard);
export const rateLimitStrict = rateLimit(RateLimitPresets.strict);
export const rateLimitAuth = rateLimit(RateLimitPresets.auth);
export const rateLimitNotifications = rateLimit(RateLimitPresets.notifications);
export const rateLimitWebhooks = rateLimit(RateLimitPresets.webhooks);
