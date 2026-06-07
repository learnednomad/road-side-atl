-- Money-path integrity: DB-level invariants + persistent webhook idempotency.
-- See db/schema/{payments,provider-payouts,webhook-events}.ts. Idempotent so it
-- is safe to apply alongside `drizzle-kit push`.

-- ── L2: partial-refund payment status ───────────────────────────
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'partially_refunded';

-- ── M6: persistent processed-webhook log ────────────────────────
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" text NOT NULL,
  "source" text NOT NULL,
  "processedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "webhook_events_source_id_pk" PRIMARY KEY ("source", "id")
);

-- ── M6: one payment per Stripe Checkout Session (nulls exempt) ───
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_payments_stripe_session"
  ON "payments" ("stripeSessionId")
  WHERE "stripeSessionId" IS NOT NULL;

-- ── M6: one standard payout per booking ─────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_payout_standard_booking"
  ON "provider_payouts" ("bookingId")
  WHERE "payoutType" = 'standard';

-- ── M6: one clawback per original payout ────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_payout_clawback_original"
  ON "provider_payouts" ("originalPayoutId")
  WHERE "payoutType" = 'clawback' AND "originalPayoutId" IS NOT NULL;
