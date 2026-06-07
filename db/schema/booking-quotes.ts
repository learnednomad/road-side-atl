import { pgTable, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { bookings } from "./bookings";

export const bookingQuoteStatusEnum = pgEnum("booking_quote_status", [
  "sent",
  "approved",
  "declined",
]);

export type QuoteLineItem = { description: string; amountCents: number };

/**
 * Provider-built quote for a booking after on-site inspection (two-stage
 * inspect→approve). Customer approval writes bookings.finalPrice. One active
 * quote drives the price; the immutable pricingSnapshot keeps the approved
 * number stable.
 */
export const bookingQuotes = pgTable("booking_quotes", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  bookingId: text("bookingId")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  providerId: text("providerId").notNull(), // app-level ref
  lineItems: jsonb("lineItems").$type<QuoteLineItem[]>().notNull().default([]),
  totalCents: integer("totalCents").notNull(),
  status: bookingQuoteStatusEnum("status").notNull().default("sent"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  approvedAt: timestamp("approvedAt", { mode: "date" }),
});
