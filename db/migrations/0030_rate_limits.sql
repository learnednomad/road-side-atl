-- Durable rate-limit / brute-force counters (auth endpoints + login lockout).
-- See db/schema/rate-limits.ts. Idempotent so it is safe to apply alongside
-- `drizzle-kit push`.

CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" text PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "windowStart" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
