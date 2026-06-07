CREATE TYPE "public"."b2b_credit_txn_type" AS ENUM('charge', 'payment', 'adjustment');--> statement-breakpoint
CREATE TABLE "b2b_credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"type" "b2b_credit_txn_type" NOT NULL,
	"amountCents" integer NOT NULL,
	"bookingId" text,
	"invoiceId" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "b2b_credit_transactions" ADD CONSTRAINT "b2b_credit_transactions_accountId_b2b_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."b2b_accounts"("id") ON DELETE cascade ON UPDATE no action;