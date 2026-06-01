-- Add ic_agreement onboarding step type and backfill for in-flight providers

-- ── Add "ic_agreement" to step_type enum ────────────────────────
ALTER TYPE "public"."step_type" ADD VALUE IF NOT EXISTS 'ic_agreement';

-- ── Backfill: insert pending ic_agreement step for any in-flight
-- provider that does not already have one. Active/suspended/rejected
-- providers are left alone — they get the agreement requirement in a
-- follow-up enforcement pass.
INSERT INTO "onboarding_steps" ("id", "providerId", "stepType", "status", "createdAt", "updatedAt")
SELECT
  -- cuid2-compatible 24-char id (good enough for backfill; new rows use createId())
  substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  p."id",
  'ic_agreement',
  'pending',
  now(),
  now()
FROM "providers" p
WHERE p."status" IN ('applied', 'onboarding', 'pending_review')
  AND NOT EXISTS (
    SELECT 1 FROM "onboarding_steps" s
    WHERE s."providerId" = p."id" AND s."stepType" = 'ic_agreement'
  );
