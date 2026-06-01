-- Phase 3: Payment methods, trust tier tracking, pricing zones, promotions

-- ── Users: payment method + trust tier tracking ──────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "defaultPaymentMethodId" text;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "trustTierUpdatedAt" timestamp;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "trustTierReason" text;

-- ── Pricing zones ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pricing_zones" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "polygon" jsonb NOT NULL,
  "baseMultiplierBp" integer NOT NULL DEFAULT 10000,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- ── Promotions (backed by Stripe Coupons) ───────────────────────
CREATE TABLE IF NOT EXISTS "promotions" (
  "id" text PRIMARY KEY,
  "stripeCouponId" text NOT NULL,
  "stripePromotionCodeId" text,
  "code" text NOT NULL UNIQUE,
  "description" text,
  "discountType" text NOT NULL,
  "discountAmount" integer NOT NULL,
  "maxRedemptions" integer,
  "currentRedemptions" integer NOT NULL DEFAULT 0,
  "expiresAt" timestamp,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
