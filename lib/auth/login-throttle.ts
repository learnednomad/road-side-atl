/**
 * Brute-force throttle for the NextAuth credentials login.
 *
 * The web login (`/api/auth/[...nextauth]`) runs outside the Hono app, so the
 * rate-limit middleware never touches it. This adds a durable, Postgres-backed
 * limit keyed on BOTH the target email and the client IP, called from the
 * credentials `authorize()` callback. Per-email throttling protects a single
 * account against distributed credential stuffing; per-IP protects against one
 * source spraying many accounts.
 */
import { checkRateLimitDb, clearRateLimitDb } from "@/server/api/lib/rate-limiter-db";
import { resolveClientIp } from "@/lib/client-ip";

// 10 attempts per 15 minutes — generous for humans, fast to trip for bots.
const LOGIN_LIMIT = { maxRequests: 10, windowMs: 15 * 60 * 1000 };

function emailKey(email: string): string {
  return `login:email:${email.toLowerCase().trim()}`;
}

/**
 * Throws `Error("TooManyAttempts")` if the email or the client IP has exceeded
 * the login attempt limit. Counts every attempt; call `clearLoginThrottle` on
 * success so legitimate users don't accumulate toward the limit.
 */
export async function assertLoginAllowed(
  email: string,
  headers?: Headers
): Promise<void> {
  const keys = [emailKey(email)];
  const ip = headers ? resolveClientIp((name) => headers.get(name)) : null;
  if (ip) keys.push(`login:ip:${ip}`);

  let exceeded = false;
  try {
    for (const key of keys) {
      const result = await checkRateLimitDb(key, LOGIN_LIMIT);
      if (!result.allowed) exceeded = true;
    }
  } catch (err) {
    // The throttle store being unavailable must not block legitimate logins.
    console.error("[LoginThrottle] store error — allowing login:", err);
    return;
  }
  if (exceeded) {
    throw new Error("TooManyAttempts");
  }
}

/** Reset the per-email login counter after a successful authentication. */
export async function clearLoginThrottle(email: string): Promise<void> {
  await clearRateLimitDb(emailKey(email));
}
