-- Add stripeCustomerId to users for Stripe Customer object tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_stripe_customer_id_idx" ON users("stripeCustomerId");

-- Add stripeProductId to services for Stripe Product catalog linkage
ALTER TABLE services ADD COLUMN IF NOT EXISTS "stripeProductId" TEXT;

-- Populate Stripe product IDs for existing services (test mode)
UPDATE services SET "stripeProductId" = 'prod_U35XFf7M75RFv0' WHERE slug = 'jump-start';
UPDATE services SET "stripeProductId" = 'prod_U35X5GfgeeQ6wO' WHERE slug = 'towing';
UPDATE services SET "stripeProductId" = 'prod_U35XZpmCrERBTn' WHERE slug = 'lockout';
UPDATE services SET "stripeProductId" = 'prod_U35XZ30z2FtQDO' WHERE slug = 'flat-tire';
UPDATE services SET "stripeProductId" = 'prod_U35Xu1RUmKgsgA' WHERE slug = 'fuel-delivery';
UPDATE services SET "stripeProductId" = 'prod_U35XquWwK6bsGz' WHERE slug = 'basic-inspection';
UPDATE services SET "stripeProductId" = 'prod_U35X3LHJMM6fIh' WHERE slug = 'standard-inspection';
UPDATE services SET "stripeProductId" = 'prod_U35XunLmR8387t' WHERE slug = 'premium-inspection';
