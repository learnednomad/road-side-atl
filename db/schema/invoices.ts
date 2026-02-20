import { pgTable, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { bookings } from "./bookings";
import { payments } from "./payments";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
  "void",
  "overdue",
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
  invoiceNumber: text("invoiceNumber").notNull().unique(),
  bookingId: text("bookingId")
    .references(() => bookings.id, { onDelete: "cascade" }),
  paymentId: text("paymentId").references(() => payments.id),
  customerName: text("customerName").notNull(),
  customerEmail: text("customerEmail").notNull(),
  customerPhone: text("customerPhone").notNull(),
  lineItems: jsonb("lineItems").$type<InvoiceLineItem[]>().notNull(),
  subtotal: integer("subtotal").notNull(), // cents
  total: integer("total").notNull(), // cents
  status: invoiceStatusEnum("status").notNull().default("draft"),
  providerId: text("providerId"),
  providerName: text("providerName"),
  issuedAt: timestamp("issuedAt", { mode: "date" }),
  paidAt: timestamp("paidAt", { mode: "date" }),
  notes: text("notes"),
  tenantId: text("tenantId"),
  dueDate: timestamp("dueDate", { mode: "date" }),
  billingPeriodStart: text("billingPeriodStart"),
  billingPeriodEnd: text("billingPeriodEnd"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
