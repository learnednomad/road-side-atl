/**
 * Postgres-backed rate limiter (fixed-window).
 *
 * Durable across restarts and shared across instances, unlike the in-memory
 * limiter in ./rate-limiter. Used for auth endpoints and login lockout where a
 * counter that survives a deploy actually matters. The window step is atomic via
 * INSERT ... ON CONFLICT DO UPDATE, so concurrent requests can't race the count.
 */
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import type { RateLimitConfig, RateLimitResult } from "./rate-limiter";

export async function checkRateLimitDb(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const windowSecs = Math.max(1, Math.round(config.windowMs / 1000));

  // True when the existing window has elapsed and the counter should reset.
  const expired = sql`${rateLimits.windowStart} < now() - (${windowSecs})::int * interval '1 second'`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: new Date() })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN now() ELSE ${rateLimits.windowStart} END`,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  const count = row.count;
  const elapsed = Date.now() - new Date(row.windowStart).getTime();
  const resetMs = Math.max(0, config.windowMs - elapsed);

  return {
    allowed: count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    resetMs,
  };
}

/** Reset a counter, e.g. after a successful login. */
export async function clearRateLimitDb(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
