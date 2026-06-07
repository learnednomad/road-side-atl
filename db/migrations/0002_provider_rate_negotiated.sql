ALTER TABLE "providers" ADD COLUMN "rateIsNegotiated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill: existing providers whose rate differs from the default are negotiated.
UPDATE "providers" SET "rateIsNegotiated" = ("commissionRate" <> 7000);
