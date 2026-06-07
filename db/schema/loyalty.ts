import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { users } from "./users";

export const loyaltyTxnTypeEnum = pgEnum("loyalty_txn_type", ["earn", "redeem", "adjust"]);

/**
 * Loyalty points ledger. 1 point earned per $1 of completed booking spend;
 * 1 point redeems for 1 cent of discount. The sum of points equals
 * users.loyaltyPoints (kept in sync transactionally). Positive = earn/credit,
 * negative = redeem.
 */
export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull(), // signed
  type: loyaltyTxnTypeEnum("type").notNull(),
  bookingId: text("bookingId"), // app-level ref
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
