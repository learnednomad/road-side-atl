-- Add payout method and metadata columns to provider_payouts
-- Story 13-2: Payout Routing, Abandonment Reminders & Manual Deprecation

DO $$ BEGIN
  CREATE TYPE "public"."payout_method" AS ENUM('manual_batch', 'stripe_connect');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "provider_payouts"
  ADD COLUMN IF NOT EXISTS "payoutMethod" "payout_method" NOT NULL DEFAULT 'manual_batch';

ALTER TABLE "provider_payouts"
  ADD COLUMN IF NOT EXISTS "metadata" jsonb;

-- Backfill existing payouts as manual_batch (default handles this, but explicit for clarity)
UPDATE "provider_payouts" SET "payoutMethod" = 'manual_batch' WHERE "payoutMethod" IS NULL;
