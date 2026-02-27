-- Add "disputed" status to payment_status enum
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'disputed';

-- Add stripePaymentIntentId column for webhook event cross-referencing
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;

-- Index for PaymentIntent lookups (used by charge.refunded, dispute, and payment_failed webhooks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payments_stripe_payment_intent_id_idx" ON payments("stripePaymentIntentId");
