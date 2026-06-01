import { pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createId } from "./utils";

/**
 * Service bundles — packaged combinations of services at a discounted rate.
 * Example: "Jump Start + Battery Test" at $120 instead of $75 + $75.
 */
export const serviceBundles = pgTable("service_bundles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  serviceIds: jsonb("serviceIds").$type<string[]>().notNull(), // references services.id
  bundlePrice: integer("bundlePrice").notNull(), // cents — overrides individual base prices
  savingsAmount: integer("savingsAmount"), // cents — how much customer saves vs individual pricing
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
