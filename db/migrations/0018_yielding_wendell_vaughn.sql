CREATE TYPE "public"."scheduling_mode" AS ENUM('immediate', 'scheduled', 'both');--> statement-breakpoint
ALTER TYPE "public"."service_category" ADD VALUE 'mechanics';--> statement-breakpoint
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
CREATE TABLE "beta_users" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"source" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "beta_users_userId_unique" UNIQUE("userId")
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
ALTER TABLE "services" ADD COLUMN "schedulingMode" "scheduling_mode" DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "createdById" text NOT NULL;--> statement-breakpoint
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
ALTER TABLE "beta_users" ADD CONSTRAINT "beta_users_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_users_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;