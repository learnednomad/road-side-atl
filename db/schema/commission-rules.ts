import { pgTable, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";

export const commissionScopeEnum = pgEnum("commission_scope", [
  "global",
  "service",
  "provider",
  "account",
]);

/**
 * Configurable commission rules — the platform's cut (basis points) resolved by
 * scope precedence at quote/payout time: account > provider > service > global,
 * then priority desc. When no rule matches, the legacy logic in
 * computeProviderAmount applies (so an empty table = no behavior change).
 * scopeId holds the account/provider/service id (null for global).
 */
export const commissionRules = pgTable("commission_rules", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  scope: commissionScopeEnum("scope").notNull(),
  scopeId: text("scopeId"), // null for global
  commissionRateBp: integer("commissionRateBp").notNull(), // platform cut, basis points
  priority: integer("priority").notNull().default(0),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
