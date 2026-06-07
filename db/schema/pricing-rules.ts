import { pgTable, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "./utils";

export const pricingRuleScopeEnum = pgEnum("pricing_rule_scope", ["global", "service"]);

/**
 * Configurable pricing-rules matrix (roadmap 1a). A multiplier (basis points)
 * resolved by scope precedence service > global, then priority. Applied by
 * calculateBookingPrice ONLY when the PRICING_MATRIX feature flag is on — an
 * empty table / flag-off = no change to current pricing. Zone/weather-scoped
 * rules + the location context are a follow-up.
 */
export const pricingRules = pgTable("pricing_rules", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  scope: pricingRuleScopeEnum("scope").notNull(),
  scopeId: text("scopeId"), // serviceId for scope=service, null for global
  multiplierBp: integer("multiplierBp").notNull(), // 10000 = 1.0x
  priority: integer("priority").notNull().default(0),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
