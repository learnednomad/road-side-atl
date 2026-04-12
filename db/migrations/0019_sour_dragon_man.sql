ALTER TABLE "bookings" ADD COLUMN "offerExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "dispatchAttempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD COLUMN "score" real;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD COLUMN "attemptNumber" integer;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD COLUMN "scoringWeights" jsonb;