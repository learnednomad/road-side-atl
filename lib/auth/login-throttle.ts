/**
 * Brute-force throttle for the NextAuth credentials login.
 *
 * The web login (`/api/auth/[...nextauth]`) runs outside the Hono app, so the
 * rate-limit middleware never touches it. This adds a durable, Postgres-backed
 * lockout keyed on BOTH the target email and the client IP.
 *
 * Crucially it counts only FAILED attempts (check is read-only; the counter is
 * incremented only on failure and cleared on success). Counting successes too
 * would let a shared office/NAT IP lock itself out after a handful of normal
 * logins — the very shared-bucket problem the rate-limiter fix set out to avoid.
 * Per-email protects a targeted account against distributed credential stuffing;
 * per-IP catches one source spraying many accounts.
 */
import {
  checkRateLimitDb,
  clearRateLimitDb,
  peekRateLimitDb,
} from "@/server/api/lib/rate-limiter-db";
import { resolveClientIp } from "@/lib/client-ip";

// 10 failed attempts per 15 minutes — generous for humans, fast to trip for bots.
const LOGIN_LIMIT = { maxRequests: 10, windowMs: 15 * 60 * 1000 };

function emailKey(email: string): string {
  return `login:email:${email.toLowerCase().trim()}`;
}

function ipFromHeaders(headers?: Headers): string | null {
  return headers ? resolveClientIp((name) => headers.get(name)) : null;
}

/**
 * Throws `Error("TooManyAttempts")` if the email or client IP is currently
 * locked out. Read-only — does not count this attempt.
 */
export async function assertLoginAllowed(
  email: string,
  headers?: Headers
): Promise<void> {
  if (!(await peekRateLimitDb(emailKey(email), LOGIN_LIMIT))) {
    throw new Error("TooManyAttempts");
  }
  const ip = ipFromHeaders(headers);
  if (ip && !(await peekRateLimitDb(`login:ip:${ip}`, LOGIN_LIMIT))) {
    throw new Error("TooManyAttempts");
  }
}

/** Record a failed login attempt against both the email and the client IP. */
export async function recordLoginFailure(
  email: string,
  headers?: Headers
): Promise<void> {
  try {
    await checkRateLimitDb(emailKey(email), LOGIN_LIMIT);
    const ip = ipFromHeaders(headers);
    if (ip) await checkRateLimitDb(`login:ip:${ip}`, LOGIN_LIMIT);
  } catch (err) {
    // Never let throttle bookkeeping break the login response.
    console.error("[LoginThrottle] failed to record attempt:", err);
  }
}

/** Clear the email + IP counters after a successful authentication. */
export async function clearLoginThrottle(
  email: string,
  headers?: Headers
): Promise<void> {
  try {
    await clearRateLimitDb(emailKey(email));
    const ip = ipFromHeaders(headers);
    if (ip) await clearRateLimitDb(`login:ip:${ip}`);
  } catch (err) {
    console.error("[LoginThrottle] failed to clear counters:", err);
  }
}
