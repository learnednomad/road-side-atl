CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
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
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceNumber" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"createdById" text NOT NULL,
	"customerId" text,
	"customerName" text NOT NULL,
	"customerEmail" text,
	"customerPhone" text,
	"customerCompany" text,
	"customerAddress" text,
	"issueDate" timestamp DEFAULT now() NOT NULL,
	"dueDate" timestamp,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"taxRate" integer DEFAULT 0 NOT NULL,
	"taxAmount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"paymentTerms" text,
	"paymentMethod" text,
	"paymentInstructions" text,
	"notes" text,
	"tenantId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoiceNumber_unique" UNIQUE("invoiceNumber")
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
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_users_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_users_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_invoices_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;