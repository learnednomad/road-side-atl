import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";
import { b2bAccounts } from "./b2b-accounts";

export const b2bCreditTxnTypeEnum = pgEnum("b2b_credit_txn_type", [
  "charge", // a NET booking drew down credit (+ to balance owed)
  "payment", // account paid down its balance (- to balance owed)
  "adjustment", // manual correction (signed)
]);

/**
 * Append-only ledger of NET-terms credit movements for a B2B account. The sum of
 * amountCents equals b2b_accounts.currentBalanceCents (kept in sync in the same
 * transaction as each movement). Positive = increases balance owed; negative =
 * reduces it.
 */
export const b2bCreditTransactions = pgTable("b2b_credit_transactions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  accountId: text("accountId")
    .notNull()
    .references(() => b2bAccounts.id, { onDelete: "cascade" }),
  type: b2bCreditTxnTypeEnum("type").notNull(),
  amountCents: integer("amountCents").notNull(), // signed
  bookingId: text("bookingId"), // app-level ref (charge)
  invoiceId: text("invoiceId"), // app-level ref (payment)
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
