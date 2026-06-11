ALTER TABLE "users" ADD COLUMN "identityVerified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "identityVerifiedAt" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripeIdentitySessionId" text;