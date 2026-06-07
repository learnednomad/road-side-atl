CREATE TYPE "public"."b2b_pricing_mode" AS ENUM('retail', 'discount', 'price_list', 'contract');--> statement-breakpoint
CREATE TABLE "b2b_price_list" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"serviceId" text NOT NULL,
	"priceCents" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "b2b_accounts" ADD COLUMN "accountNumber" text;--> statement-breakpoint
ALTER TABLE "b2b_accounts" ADD COLUMN "pricingMode" "b2b_pricing_mode" DEFAULT 'retail' NOT NULL;--> statement-breakpoint
ALTER TABLE "b2b_accounts" ADD COLUMN "defaultDiscountBp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "b2b_accounts" ADD COLUMN "commissionRateBp" integer;--> statement-breakpoint
ALTER TABLE "b2b_accounts" ADD COLUMN "creditLimitCents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "b2b_accounts" ADD COLUMN "currentBalanceCents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "b2b_price_list" ADD CONSTRAINT "b2b_price_list_accountId_b2b_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."b2b_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2b_price_list" ADD CONSTRAINT "b2b_price_list_serviceId_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_b2b_price_list_account_service" ON "b2b_price_list" USING btree ("accountId","serviceId");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_b2b_account_number" ON "b2b_accounts" USING btree ("accountNumber") WHERE "b2b_accounts"."accountNumber" IS NOT NULL;
--> statement-breakpoint
-- Backfill accountNumber for existing accounts (B2B-00001, ...).
UPDATE "b2b_accounts" a SET "accountNumber" = 'B2B-' || lpad(s.rn::text, 5, '0')
FROM (SELECT id, row_number() OVER (ORDER BY "createdAt") rn FROM "b2b_accounts") s
WHERE a.id = s.id AND a."accountNumber" IS NULL;
