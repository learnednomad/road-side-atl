import { pgTable, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { providers } from "./providers";
import { bookings } from "./bookings";

export const payoutStatusEnum = pgEnum("payout_status", ["pending", "paid", "clawback"]);
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
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
