import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { users } from "./users";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
]);

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
  issueDate: timestamp("issueDate", { mode: "date" }).defaultNow().notNull(),
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
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
