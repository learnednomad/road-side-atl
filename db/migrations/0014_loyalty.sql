CREATE TYPE "public"."loyalty_txn_type" AS ENUM('earn', 'redeem', 'adjust');--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"points" integer NOT NULL,
	"type" "loyalty_txn_type" NOT NULL,
	"bookingId" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loyaltyPoints" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;