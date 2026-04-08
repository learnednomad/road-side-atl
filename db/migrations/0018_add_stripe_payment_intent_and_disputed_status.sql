ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'disputed';--> statement-breakpoint
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_stripe_payment_intent_id_idx" ON payments("stripePaymentIntentId");
