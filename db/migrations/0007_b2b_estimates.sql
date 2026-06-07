CREATE TYPE "public"."b2b_estimate_status" AS ENUM('draft', 'approved', 'converted', 'expired');--> statement-breakpoint
CREATE TABLE "b2b_estimates" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"title" text NOT NULL,
	"status" "b2b_estimate_status" DEFAULT 'draft' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotalCents" integer DEFAULT 0 NOT NULL,
	"estMinCents" integer DEFAULT 0 NOT NULL,
	"estMaxCents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"validUntil" timestamp,
	"convertedBookingIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "b2b_estimates" ADD CONSTRAINT "b2b_estimates_accountId_b2b_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."b2b_accounts"("id") ON DELETE cascade ON UPDATE no action;