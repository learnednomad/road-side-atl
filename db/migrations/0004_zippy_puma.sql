CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceNumber" text NOT NULL,
	"bookingId" text NOT NULL,
	"paymentId" text,
	"customerName" text NOT NULL,
	"customerEmail" text NOT NULL,
	"customerPhone" text NOT NULL,
	"lineItems" jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"total" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"providerId" text,
	"providerName" text,
	"issuedAt" timestamp,
	"paidAt" timestamp,
	"notes" text,
	"tenantId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoiceNumber_unique" UNIQUE("invoiceNumber")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paymentId_payments_id_fk" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;