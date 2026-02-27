ALTER TYPE "public"."invoice_status" ADD VALUE 'overdue';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "dueDate" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "billingPeriodStart" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "billingPeriodEnd" text;