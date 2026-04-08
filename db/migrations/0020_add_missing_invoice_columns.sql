ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "bookingId" text REFERENCES "bookings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paymentId" text REFERENCES "payments"("id");--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "lineItems" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "providerId" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "providerName" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issuedAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paidAt" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billingPeriodStart" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billingPeriodEnd" text;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "createdById" DROP NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'issued' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status')) THEN
    ALTER TYPE "invoice_status" ADD VALUE 'issued';
  END IF;
END$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'void' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status')) THEN
    ALTER TYPE "invoice_status" ADD VALUE 'void';
  END IF;
END$$;
