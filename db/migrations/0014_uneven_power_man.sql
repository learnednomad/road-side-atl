ALTER TYPE "public"."provider_status" ADD VALUE 'resubmission_requested';--> statement-breakpoint
ALTER TYPE "public"."payout_status" ADD VALUE 'clawback';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refundAmount" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refundedAt" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refundedBy" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refundReason" text;--> statement-breakpoint
ALTER TABLE "provider_payouts" ADD COLUMN "payoutType" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_payouts" ADD COLUMN "originalPayoutId" text;--> statement-breakpoint
ALTER TABLE "provider_payouts" ADD COLUMN "paymentId" text;--> statement-breakpoint
ALTER TABLE "provider_payouts" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refundedBy_users_id_fk" FOREIGN KEY ("refundedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;