import { pgTable, text, integer, timestamp, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  "partially_refunded",
  "disputed",
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
  stripePaymentIntentId: text("stripePaymentIntentId"),
  confirmedAt: timestamp("confirmedAt", { mode: "date" }),
  confirmedBy: text("confirmedBy").references(() => users.id),
  tenantId: text("tenantId"),
  refundAmount: integer("refundAmount"), // cents, null = no refund
  refundedAt: timestamp("refundedAt", { mode: "date" }),
  refundedBy: text("refundedBy").references(() => users.id),
  refundReason: text("refundReason"),
  stripeTransferId: text("stripeTransferId"), // auto-created transfer ID from destination charges
  applicationFeeAmount: integer("applicationFeeAmount"), // cents, platform's cut (for destination charges)
  chargeType: text("chargeType"), // "destination" | "platform" — tracks which charge model was used
  stripeConnectAccountId: text("stripeConnectAccountId"), // provider's Connect account used for this payment
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  // One payment row per Stripe Checkout Session — backstops duplicate
  // confirmation from webhook retries (M6). Nulls (cash/zelle) are exempt.
  uniqStripeSession: uniqueIndex("uniq_payments_stripe_session")
    .on(t.stripeSessionId)
    .where(sql`${t.stripeSessionId} IS NOT NULL`),
  // FK join + payment-confirmation lookup by booking (hot path).
  booking: index("idx_payments_booking").on(t.bookingId),
  // Revenue dashboards: filter by status + ORDER BY/range on createdAt.
  statusCreated: index("idx_payments_status_created").on(t.status, t.createdAt),
}));
