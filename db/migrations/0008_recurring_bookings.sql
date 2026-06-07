CREATE TYPE "public"."recurring_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "recurring_booking_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"serviceId" text NOT NULL,
	"template" jsonb NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"intervalCount" integer DEFAULT 1 NOT NULL,
	"nextRunAt" timestamp NOT NULL,
	"lastRunAt" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_booking_schedules" ADD CONSTRAINT "recurring_booking_schedules_accountId_b2b_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."b2b_accounts"("id") ON DELETE cascade ON UPDATE no action;