ALTER TABLE users ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_stripe_customer_id_idx" ON users("stripeCustomerId");--> statement-breakpoint
ALTER TABLE services ADD COLUMN IF NOT EXISTS "stripeProductId" TEXT;
