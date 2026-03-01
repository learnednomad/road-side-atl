-- Add missing columns to invoices table that the schema expects but DB lacks
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "bookingId" text REFERENCES "bookings"("id") ON DELETE CASCADE;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paymentId" text REFERENCES "payments"("id");
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "lineItems" jsonb;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "providerId" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "providerName" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issuedAt" timestamp;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paidAt" timestamp;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billingPeriodStart" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billingPeriodEnd" text;

-- Make createdById nullable (provider-invoices route creates without it)
ALTER TABLE "invoices" ALTER COLUMN "createdById" DROP NOT NULL;

-- Add 'issued' and 'void' to invoice_status enum if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'issued' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status')) THEN
    ALTER TYPE "invoice_status" ADD VALUE 'issued';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'void' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status')) THEN
    ALTER TYPE "invoice_status" ADD VALUE 'void';
  END IF;
END$$;
