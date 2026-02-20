import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { bookings } from "./bookings";
import { users } from "./users";

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "cashapp",
  "zelle",
  "stripe",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "confirmed",
  "failed",
  "refunded",
]);

export const payments = pgTable("payments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  bookingId: text("bookingId")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // cents
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  stripeSessionId: text("stripeSessionId"),
  confirmedAt: timestamp("confirmedAt", { mode: "date" }),
  confirmedBy: text("confirmedBy").references(() => users.id),
  tenantId: text("tenantId"),
  refundAmount: integer("refundAmount"), // cents, null = no refund
  refundedAt: timestamp("refundedAt", { mode: "date" }),
  refundedBy: text("refundedBy").references(() => users.id),
  refundReason: text("refundReason"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
