CREATE TYPE "public"."step_status" AS ENUM('pending', 'draft', 'in_progress', 'pending_review', 'complete', 'rejected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."step_type" AS ENUM('background_check', 'insurance', 'certifications', 'training', 'stripe_connect');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('insurance', 'certification', 'vehicle_doc');--> statement-breakpoint
ALTER TYPE "public"."provider_status" ADD VALUE 'applied';--> statement-breakpoint
ALTER TYPE "public"."provider_status" ADD VALUE 'onboarding';--> statement-breakpoint
ALTER TYPE "public"."provider_status" ADD VALUE 'pending_review';--> statement-breakpoint
ALTER TYPE "public"."provider_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TYPE "public"."provider_status" ADD VALUE 'suspended';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'disputed';--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"companyName" text NOT NULL,
	"companyAddress" text,
	"companyPhone" text,
	"companyEmail" text,
	"logoUrl" text,
	"bankName" text,
	"bankAccountName" text,
	"bankAccountNumber" text,
	"bankRoutingNumber" text,
	"bankSwiftCode" text,
	"defaultPaymentTerms" text,
	"defaultPaymentMethod" text,
	"defaultPaymentInstructions" text,
	"invoicePrefix" text DEFAULT 'INV' NOT NULL,
	"defaultTaxRate" integer DEFAULT 0 NOT NULL,
	"invoiceFooterNote" text,
	"tenantId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceId" text NOT NULL,
	"description" text NOT NULL,
	"details" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"providerId" text NOT NULL,
	"stepType" "step_type" NOT NULL,
	"status" "step_status" DEFAULT 'pending' NOT NULL,
	"draftData" jsonb,
	"metadata" jsonb,
	"completedAt" timestamp,
	"reviewedBy" text,
	"reviewedAt" timestamp,
	"rejectionReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"providerId" text NOT NULL,
	"onboardingStepId" text NOT NULL,
	"documentType" "document_type" NOT NULL,
	"s3Key" text NOT NULL,
	"originalFileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"mimeType" text NOT NULL,
	"status" "document_status" DEFAULT 'pending_review' NOT NULL,
	"rejectionReason" text,
	"reviewedBy" text,
	"reviewedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"createdBy" text NOT NULL,
	"usedAt" timestamp,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
DROP TYPE "public"."invoice_status";--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'issued', 'paid', 'overdue', 'cancelled', 'void');--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."invoice_status";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DATA TYPE "public"."invoice_status" USING "status"::"public"."invoice_status";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "customerEmail" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "customerPhone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "lineItems" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "subtotal" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "total" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripeCustomerId" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "stripeProductId" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "stripeConnectAccountId" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "migrationBypassExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "activatedAt" timestamp;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "suspendedAt" timestamp;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "suspendedReason" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "previousApplicationId" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stripePaymentIntentId" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "createdById" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customerId" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customerCompany" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customerAddress" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issueDate" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "taxRate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "taxAmount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paymentTerms" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paymentMethod" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paymentInstructions" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_invoices_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_steps" ADD CONSTRAINT "onboarding_steps_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_onboardingStepId_onboarding_steps_id_fk" FOREIGN KEY ("onboardingStepId") REFERENCES "public"."onboarding_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_users_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;