import { pgTable, text, integer, timestamp, jsonb, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "./utils";
import { providers } from "./providers";
import { bookings } from "./bookings";

export const payoutStatusEnum = pgEnum("payout_status", ["pending", "paid", "clawback", "held"]);
export const payoutMethodEnum = pgEnum("payout_method", ["manual_batch", "stripe_connect"]);

export const providerPayouts = pgTable("provider_payouts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  providerId: text("providerId")
    .notNull()
    .references(() => providers.id),
  bookingId: text("bookingId")
    .notNull()
    .references(() => bookings.id),
  amount: integer("amount").notNull(), // cents, provider's earned share
  status: payoutStatusEnum("status").notNull().default("pending"),
  paidAt: timestamp("paidAt", { mode: "date" }),
  payoutMethod: payoutMethodEnum("payoutMethod").notNull().default("manual_batch"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  payoutType: text("payoutType").default("standard").notNull(), // "standard" | "clawback"
  originalPayoutId: text("originalPayoutId"), // self-ref for clawback linking
  paymentId: text("paymentId"), // ref to payment that triggered this payout/clawback
  notes: text("notes"), // admin notes (e.g., refund reason)
  stripeTransferId: text("stripeTransferId"), // Stripe Transfer ID for Connect payouts
  holdReason: text("holdReason"), // reason payout is held (e.g., dispute)
  heldAt: timestamp("heldAt", { mode: "date" }), // when payout was put on hold
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  // At most one standard payout per booking — backstops double-payout races (M6).
  uniqStandardPerBooking: uniqueIndex("uniq_payout_standard_booking")
    .on(t.bookingId)
    .where(sql`${t.payoutType} = 'standard'`),
  // At most one clawback per original payout — backstops duplicate clawbacks
  // from redelivered dispute/refund events (M6).
  uniqClawbackPerOriginal: uniqueIndex("uniq_payout_clawback_original")
    .on(t.originalPayoutId)
    .where(sql`${t.payoutType} = 'clawback' AND ${t.originalPayoutId} IS NOT NULL`),
  // Provider earnings dashboard aggregations (providerId [+ payoutType + status]).
  providerTypeStatus: index("idx_payouts_provider_type_status").on(t.providerId, t.payoutType, t.status),
  // Admin payouts list: filter by status.
  status: index("idx_payouts_status").on(t.status),
  // Admin payouts list: ORDER BY createdAt DESC.
  created: index("idx_payouts_created").on(t.createdAt),
}));
