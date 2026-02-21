import { pgTable, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { users } from "./users";
import { bookings } from "./bookings";
import { payments } from "./payments";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "issued",
  "paid",
  "overdue",
  "cancelled",
  "void",
]);

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export const invoices = pgTable("invoices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  invoiceNumber: text("invoiceNumber").unique().notNull(),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  createdById: text("createdById")
    .notNull()
    .references(() => users.id),
  // Customer fields (denormalized for one-off support)
  customerId: text("customerId").references(() => users.id, {
    onDelete: "set null",
  }),
  customerName: text("customerName").notNull(),
  customerEmail: text("customerEmail"),
  customerPhone: text("customerPhone"),
  customerCompany: text("customerCompany"),
  customerAddress: text("customerAddress"),
  // Booking/payment linkage (from main)
  bookingId: text("bookingId")
    .references(() => bookings.id, { onDelete: "cascade" }),
  paymentId: text("paymentId").references(() => payments.id),
  lineItems: jsonb("lineItems").$type<InvoiceLineItem[]>(),
  // Provider info (from main)
  providerId: text("providerId"),
  providerName: text("providerName"),
  issueDate: timestamp("issueDate", { mode: "date" }).defaultNow().notNull(),
  issuedAt: timestamp("issuedAt", { mode: "date" }),
  paidAt: timestamp("paidAt", { mode: "date" }),
  dueDate: timestamp("dueDate", { mode: "date" }),
  subtotal: integer("subtotal").notNull().default(0), // cents
  taxRate: integer("taxRate").notNull().default(0), // basis points
  taxAmount: integer("taxAmount").notNull().default(0), // cents
  total: integer("total").notNull().default(0), // cents
  paymentTerms: text("paymentTerms"),
  paymentMethod: text("paymentMethod"),
  paymentInstructions: text("paymentInstructions"),
  notes: text("notes"),
  tenantId: text("tenantId"),
  billingPeriodStart: text("billingPeriodStart"),
  billingPeriodEnd: text("billingPeriodEnd"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
