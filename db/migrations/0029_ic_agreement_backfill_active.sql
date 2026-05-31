-- Backfill ic_agreement step for already-active and suspended providers.
-- Migration 0028 only backfilled applied/onboarding/pending_review. This
-- adds the step for everyone else so the new acceptance gate has a row
-- to look at. The step starts pending; the enforcement gate blocks job
-- acceptance until the provider signs.

INSERT INTO "onboarding_steps" ("id", "providerId", "stepType", "status", "createdAt", "updatedAt")
SELECT
  substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  p."id",
  'ic_agreement',
  'pending',
  now(),
  now()
FROM "providers" p
WHERE p."status" IN ('active', 'suspended')
  AND NOT EXISTS (
    SELECT 1 FROM "onboarding_steps" s
    WHERE s."providerId" = p."id" AND s."stepType" = 'ic_agreement'
  );
