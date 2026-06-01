-- Phase 2: Surge pricing tables + identity verification step type

-- ── Add "identity_verification" to step_type enum ────────────────
ALTER TYPE "public"."step_type" ADD VALUE IF NOT EXISTS 'identity_verification';

-- ── Surge pricing configuration ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "surge_configs" (
  "id" text PRIMARY KEY,
  "zoneId" text,
  "thresholdBookingsPerHour" integer NOT NULL DEFAULT 10,
  "multiplierStepBp" integer NOT NULL DEFAULT 500,
  "maxMultiplierBp" integer NOT NULL DEFAULT 30000,
  "cooldownMinutes" integer NOT NULL DEFAULT 30,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- ── Pricing adjustments audit log ───────────────────────────────
CREATE TABLE IF NOT EXISTS "pricing_adjustments_log" (
  "id" text PRIMARY KEY,
  "bookingId" text NOT NULL,
  "adjustmentType" text NOT NULL,
  "multiplierBp" integer NOT NULL,
  "reason" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- ── Seed a default global surge config (disabled by feature flag) ──
INSERT INTO "surge_configs" ("id", "thresholdBookingsPerHour", "multiplierStepBp", "maxMultiplierBp", "cooldownMinutes", "active")
VALUES ('surge_global_default', 10, 500, 30000, 30, true)
ON CONFLICT ("id") DO NOTHING;
