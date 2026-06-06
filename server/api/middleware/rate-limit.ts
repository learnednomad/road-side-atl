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

// Warn at most once per minute when client IP cannot be resolved, so a
// misconfigured deployment (e.g. TRUST_PROXY unset behind a reverse proxy)
// is visible in logs without flooding them on every request.
let lastUnresolvedWarn = 0;

/**
 * Resolve the real client IP from the request.
 *
 * Returns `null` when no client can be identified. Callers MUST treat `null`
 * as "cannot rate limit this request" and fail open — NEVER collapse it to a
 * shared constant, or every unidentified request lands in one global bucket
 * and a single busy client (or any load behind an untrusted proxy) throttles
 * the entire site.
 *
 * When deployed behind a reverse proxy (Coolify/Traefik, nginx, Cloudflare),
 * set TRUST_PROXY=true so forwarded headers are honored. Without it, the app
 * only sees the proxy's IP and cannot distinguish real clients.
 */
function getClientId(c: Context): string | null {
  // Cloudflare sets this and overwrites any client-supplied value, so it is
  // trustworthy whenever the app actually sits behind Cloudflare.
  const cfIp = c.req.header("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Forwarded headers are spoofable unless a trusted proxy sets them, so only
  // honor them when explicitly running behind one.
  if (process.env.TRUST_PROXY === "true") {
    // nginx-style single value.
    const realIp = c.req.header("x-real-ip");
    if (realIp) return realIp.trim();

    // X-Forwarded-For: "client, proxy1, proxy2" — leftmost is the originator.
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      const client = forwarded.split(",")[0]?.trim();
      if (client) return client;
    }
  }

  const now = Date.now();
  if (now - lastUnresolvedWarn > 60000) {
    lastUnresolvedWarn = now;
    console.warn(
      "[RateLimit] Could not resolve client IP — failing open (no rate limit applied). " +
        "If this app is behind a reverse proxy, set TRUST_PROXY=true."
    );
  }
  return null;
}

/**
 * Create rate limit middleware
 */
export function rateLimit(config: RateLimitConfig = RateLimitPresets.standard) {
  return async (c: Context, next: Next) => {
    const clientId = getClientId(c);

    // Cannot identify the client → fail open. Throttling unidentified requests
    // under a shared key would lump every such client into one bucket and let a
    // single source (or any proxy that hides client IPs) 429 the whole site.
    if (clientId === null) {
      return next();
    }

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
