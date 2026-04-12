-- Add Stripe transfer tracking, dispute holds, and destination charge metadata
-- Phase 1: Destination charges + real Stripe Connect payouts

-- ── provider_payouts: transfer tracking + dispute holds ──────────

-- Add "held" to payout_status enum
ALTER TYPE "public"."payout_status" ADD VALUE IF NOT EXISTS 'held';

-- Add Stripe transfer ID for Connect payout tracking
ALTER TABLE "provider_payouts"
  ADD COLUMN IF NOT EXISTS "stripeTransferId" text;

-- Add hold columns for dispute-based payout freezes
ALTER TABLE "provider_payouts"
  ADD COLUMN IF NOT EXISTS "holdReason" text;

ALTER TABLE "provider_payouts"
  ADD COLUMN IF NOT EXISTS "heldAt" timestamp;

-- ── payments: destination charge metadata ────────────────────────

-- Track the auto-created transfer from destination charges
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "stripeTransferId" text;

-- Platform's commission (application fee) in cents — for reconciliation
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "applicationFeeAmount" integer;

-- Which charge model was used: "destination" or "platform"
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "chargeType" text;

-- Provider's Connect account used for this payment
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "stripeConnectAccountId" text;
