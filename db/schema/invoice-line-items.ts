import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { invoices } from "./invoices";

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  invoiceId: text("invoiceId")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  details: text("details"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unitPrice").notNull().default(0), // cents
  total: integer("total").notNull().default(0), // cents
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
