import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createId } from "./utils";

export const serviceCategoryEnum = pgEnum("service_category", [
  "roadside",
  "diagnostics",
  "mechanics",
]);

export const schedulingModeEnum = pgEnum("scheduling_mode", [
  "immediate",
  "scheduled",
  "both",
]);

export const services = pgTable("services", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  basePrice: integer("basePrice").notNull(), // cents
  pricePerMile: integer("pricePerMile"), // cents, nullable
  // Realistic price range a customer should expect (Atlanta market). Optional —
  // when both are present, /book renders a transparency breakdown showing
  // "Base $X, typical range $X-$Y, final quoted on-site". Final price is set
  // by the mechanic after on-site assessment.
  estimateMinCents: integer("estimateMinCents"),
  estimateMaxCents: integer("estimateMaxCents"),
  estimateNote: text("estimateNote"), // e.g. "Rotor replacement quoted separately"
  category: serviceCategoryEnum("category").notNull(),
  active: boolean("active").default(true).notNull(),
  checklistConfig: jsonb("checklistConfig").$type<{ category: string; items: string[] }[]>(),
  schedulingMode: schedulingModeEnum("schedulingMode").notNull().default("both"),
  commissionRate: integer("commissionRate").notNull().default(2500), // basis points: 2500 = 25% platform cut
  stripeProductId: text("stripeProductId"),
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
