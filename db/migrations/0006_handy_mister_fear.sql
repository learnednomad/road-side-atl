ALTER TABLE "users" ADD COLUMN "trustTier" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cleanTransactionCount" integer DEFAULT 0 NOT NULL;