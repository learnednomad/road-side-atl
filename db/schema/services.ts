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
  category: serviceCategoryEnum("category").notNull(),
  active: boolean("active").default(true).notNull(),
  checklistConfig: jsonb("checklistConfig").$type<{ category: string; items: string[] }[]>(),
  commissionRate: integer("commissionRate").notNull().default(2500), // basis points: 2500 = 25% platform cut
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
