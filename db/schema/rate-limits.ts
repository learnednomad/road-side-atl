import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Durable rate-limit / brute-force counters.
 *
 * Backs auth-endpoint rate limiting and login lockout so limits survive process
 * restarts and are shared across instances. Postgres is used deliberately
 * (no Redis) — the deployment is single-process today, and this also works
 * unchanged if it ever scales horizontally.
 *
 * `key` encodes the dimension being limited, e.g. `ip:1.2.3.4:/api/auth-routes/register`
 * or `login:email:user@example.com`.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  windowStart: timestamp("windowStart", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
