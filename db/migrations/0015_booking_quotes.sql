CREATE TYPE "public"."booking_quote_status" AS ENUM('sent', 'approved', 'declined');--> statement-breakpoint
CREATE TABLE "booking_quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"providerId" text NOT NULL,
	"lineItems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"totalCents" integer NOT NULL,
	"status" "booking_quote_status" DEFAULT 'sent' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"approvedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "booking_quotes" ADD CONSTRAINT "booking_quotes_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;