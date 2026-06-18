import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createId } from "./utils";

export const businessSettings = pgTable("business_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  companyName: text("companyName").notNull(),
  companyAddress: text("companyAddress"),
  companyPhone: text("companyPhone"),
  companyEmail: text("companyEmail"),
  logoUrl: text("logoUrl"),
  bankName: text("bankName"),
  bankAccountName: text("bankAccountName"),
  bankAccountNumber: text("bankAccountNumber"),
  bankRoutingNumber: text("bankRoutingNumber"),
  bankSwiftCode: text("bankSwiftCode"),
  defaultPaymentTerms: text("defaultPaymentTerms"),
  defaultPaymentMethod: text("defaultPaymentMethod"),
  defaultPaymentInstructions: text("defaultPaymentInstructions"),
  invoicePrefix: text("invoicePrefix").default("INV").notNull(),
  defaultTaxRate: integer("defaultTaxRate").default(0).notNull(), // basis points
  invoiceFooterNote: text("invoiceFooterNote"),
  // Receipt/invoice presentation (SABRONMBC mechanic-receipt format)
  companyTagline: text("companyTagline"), // e.g. "Auto Repair & Mechanical Services"
  warrantySummary: text("warrantySummary"), // short per-part warranty terms
  warrantyConditions: text("warrantyConditions"), // detailed conditions/exclusions
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
