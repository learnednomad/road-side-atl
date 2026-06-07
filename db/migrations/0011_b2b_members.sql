CREATE TYPE "public"."b2b_member_role" AS ENUM('owner', 'manager', 'member');--> statement-breakpoint
CREATE TABLE "b2b_account_members" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"userId" text NOT NULL,
	"role" "b2b_member_role" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "b2b_account_members" ADD CONSTRAINT "b2b_account_members_accountId_b2b_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."b2b_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2b_account_members" ADD CONSTRAINT "b2b_account_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_b2b_member_account_user" ON "b2b_account_members" USING btree ("accountId","userId");