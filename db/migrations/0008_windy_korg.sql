CREATE TYPE "public"."referral_status" AS ENUM('pending', 'credited', 'expired');--> statement-breakpoint
CREATE TABLE "observations" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"providerId" text NOT NULL,
	"items" jsonb NOT NULL,
	"followUpSent" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrerId" text NOT NULL,
	"refereeId" text,
	"bookingId" text,
	"creditAmount" integer NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"providerId" text NOT NULL,
	"findings" jsonb NOT NULL,
	"reportUrl" text,
	"emailedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referralCode" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "checklistConfig" jsonb;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_users_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_refereeId_users_id_fk" FOREIGN KEY ("refereeId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referralCode_unique" UNIQUE("referralCode");