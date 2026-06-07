/**
 * Rate limiting middleware for Hono
 */

import { Context, Next } from "hono";
import {
  checkRateLimit,
  createRateLimitKey,
  RateLimitConfig,
  RateLimitPresets,
  RateLimitResult,
} from "../lib/rate-limiter";
import { checkRateLimitDb } from "../lib/rate-limiter-db";
import { resolveClientIp } from "@/lib/client-ip";

/**
 * Resolve the real client IP from the request, or `null` when it can't be
 * identified (callers fail open). See lib/client-ip for the resolution rules.
 */
function getClientId(c: Context): string | null {
  return resolveClientIp((name) => c.req.header(name));
}

/**
 * Best-effort extraction of an `email` from a JSON request body, normalized.
 * Hono caches the parsed body, so reading it here doesn't prevent the handler
 * from reading it again. Returns null for non-JSON bodies or missing email.
 */
async function getBodyEmail(c: Context): Promise<string | null> {
  try {
    const body = await c.req.json();
    const email = body?.email;
    if (typeof email === "string" && email.includes("@")) {
      return email.toLowerCase().trim();
    }
  } catch {
    // non-JSON body, empty body, or already consumed — ignore.
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
 * Durable (Postgres-backed) rate limit middleware, for auth endpoints where the
 * counter must survive restarts and where a single account should be protected
 * regardless of source IP.
 *
 * Keys on the client IP and, when `byEmail` is set, also on the request body's
 * email — blocking if EITHER limit is exceeded. This stops a distributed-IP
 * attack against one account (per-email) as well as one IP hammering many
 * accounts (per-IP). Fails open if no identity can be derived.
 */
export function rateLimitDb(
  config: RateLimitConfig,
  opts: { byEmail?: boolean } = {}
) {
  return async (c: Context, next: Next) => {
    const ip = getClientId(c);
    const endpoint = c.req.path;

    const keys: string[] = [];
    if (ip) keys.push(`ip:${ip}:${endpoint}`);
    if (opts.byEmail) {
      const email = await getBodyEmail(c);
      if (email) keys.push(`email:${email}:${endpoint}`);
    }

    // Nothing to key on → fail open (don't share a global bucket).
    if (keys.length === 0) {
      return next();
    }

    let blocked: RateLimitResult | null = null;
    let tightest: RateLimitResult | null = null;
    try {
      for (const key of keys) {
        const result = await checkRateLimitDb(key, config);
        if (!tightest || result.remaining < tightest.remaining) tightest = result;
        if (!result.allowed) blocked = result;
      }
    } catch (err) {
      // A rate limiter must never take down the endpoint it protects. If the
      // store is unavailable (e.g. table not yet migrated), fail open.
      console.error("[RateLimit] DB store error — failing open:", err);
      return next();
    }

    const ref = blocked ?? tightest!;
    c.header("X-RateLimit-Limit", config.maxRequests.toString());
    c.header("X-RateLimit-Remaining", ref.remaining.toString());
    c.header(
      "X-RateLimit-Reset",
      Math.ceil((Date.now() + ref.resetMs) / 1000).toString()
    );

    if (blocked) {
      c.header("Retry-After", Math.ceil(blocked.resetMs / 1000).toString());
      return c.json(
        {
          error: "Too many requests",
          retryAfter: Math.ceil(blocked.resetMs / 1000),
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

// Durable variants for auth endpoints. `rateLimitAuthDb` also keys on email.
export const rateLimitAuthDb = rateLimitDb(RateLimitPresets.auth, { byEmail: true });
export const rateLimitStrictDb = rateLimitDb(RateLimitPresets.strict);
