ALTER TABLE "webhook_events" ADD COLUMN "eventType" text;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "status" text DEFAULT 'processed' NOT NULL;