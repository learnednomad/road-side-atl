CREATE TYPE "public"."b2b_account_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."b2b_payment_terms" AS ENUM('prepaid', 'net_30', 'net_60');--> statement-breakpoint
CREATE TABLE "b2b_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"companyName" text NOT NULL,
	"contactName" text NOT NULL,
	"contactEmail" text NOT NULL,
	"contactPhone" text NOT NULL,
	"billingAddress" jsonb NOT NULL,
	"paymentTerms" "b2b_payment_terms" DEFAULT 'net_30' NOT NULL,
	"status" "b2b_account_status" DEFAULT 'active' NOT NULL,
	"contract" jsonb DEFAULT 'null'::jsonb,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "taxId" text;